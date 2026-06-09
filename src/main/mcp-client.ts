import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

const MCP_COMMAND = process.env.PQ_MCP_COMMAND || 'dotnet';
const MCP_ARGS = process.env.PQ_MCP_ARGS?.split(' ') || [
  'run',
  '--project',
  '/Users/mihirwagle/projects/DataFactory.MCP-public/DataFactory.MCP',
  '--',
  '--device-code-auth',
  '--interactive-auth',
];

const DEFAULT_TIMEOUT_MS = 30_000;
const INIT_TIMEOUT_MS = 60_000;

const CLIENT_INFO = { name: 'pq-workbench', version: '0.1.0' };
const PROTOCOL_VERSION = '2025-03-26';

type McpToolContent = { type: string; text: string };

export interface McpToolResult {
  content: McpToolContent[];
  isError?: boolean;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class McpClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private nextId = 0;
  private pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private buffer = '';
  private initialized = false;
  private starting = false;
  private startPromise: Promise<void> | null = null;

  get connected(): boolean {
    return this.initialized && this.process !== null && this.process.exitCode === null;
  }

  async start(): Promise<void> {
    if (this.connected) return;
    if (this.starting && this.startPromise) return this.startPromise;

    this.starting = true;
    this.startPromise = this.doStart();

    try {
      await this.startPromise;
    } finally {
      this.starting = false;
      this.startPromise = null;
    }
  }

  private async doStart(): Promise<void> {
    this.cleanup();

    console.log(`[MCP] Starting: ${MCP_COMMAND} ${MCP_ARGS.join(' ')}`);

    const child = spawn(MCP_COMMAND, MCP_ARGS, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.process = child;

    child.stdout!.setEncoding('utf8');
    child.stdout!.on('data', (chunk: string) => this.onStdout(chunk));
    child.stderr!.setEncoding('utf8');
    child.stderr!.on('data', (chunk: string) => {
      // Log stderr for diagnostics but don't treat as fatal
      for (const line of chunk.split('\n')) {
        if (line.trim()) console.log(`[MCP stderr] ${line}`);
      }
    });

    child.on('error', (err) => {
      console.error(`[MCP] Process error: ${err.message}`);
      this.rejectAllPending(new Error(`MCP server process error: ${err.message}`));
      this.initialized = false;
      this.emit('disconnected', err.message);
    });

    child.on('exit', (code, signal) => {
      console.log(`[MCP] Process exited: code=${code} signal=${signal}`);
      this.rejectAllPending(new Error(`MCP server exited (code=${code})`));
      this.initialized = false;
      this.emit('disconnected', `Process exited with code ${code}`);
    });

    // Perform MCP initialize handshake
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    const result = await this.sendRequest('initialize', {
      capabilities: {},
      clientInfo: CLIENT_INFO,
      protocolVersion: PROTOCOL_VERSION,
    }, INIT_TIMEOUT_MS) as { protocolVersion?: string; serverInfo?: unknown };

    console.log(`[MCP] Server initialized:`, JSON.stringify(result));

    // Send initialized notification (no id — it's a notification)
    this.sendNotification('notifications/initialized', {});
    this.initialized = true;
    this.emit('connected');
  }

  async callTool(name: string, args: Record<string, unknown> = {}, timeoutMs?: number): Promise<McpToolResult> {
    if (!this.connected) {
      await this.start();
    }

    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    }, timeoutMs ?? DEFAULT_TIMEOUT_MS) as McpToolResult;

    if (result.isError) {
      const errorText = result.content?.map(c => c.text).join('\n') || 'Unknown MCP tool error';
      throw new Error(`MCP tool "${name}" error: ${errorText}`);
    }

    return result;
  }

  /** Extract the text content from a tool result, parsing JSON if possible. */
  static parseText(result: McpToolResult): string {
    return result.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');
  }

  /** Extract text and parse it as JSON. */
  static parseJson<T>(result: McpToolResult): T {
    const text = McpClient.parseText(result);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Failed to parse MCP response as JSON: ${text.slice(0, 200)}`);
    }
  }

  stop(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.rejectAllPending(new Error('MCP client shutting down'));
    if (this.process) {
      try {
        this.process.kill('SIGTERM');
      } catch { /* already dead */ }
      this.process = null;
    }
    this.initialized = false;
    this.buffer = '';
    this.nextId = 0;
  }

  private sendRequest(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin) {
        return reject(new Error('MCP server not running'));
      }

      const id = this.nextId++;
      const msg = JSON.stringify({ jsonrpc: '2.0', method, params, id });

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request "${method}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      this.process.stdin.write(msg + '\n', (err) => {
        if (err) {
          this.pending.delete(id);
          clearTimeout(timer);
          reject(new Error(`Failed to write to MCP stdin: ${err.message}`));
        }
      });
    });
  }

  private sendNotification(method: string, params: unknown): void {
    if (!this.process || !this.process.stdin) return;
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params });
    this.process.stdin.write(msg + '\n');
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    // Keep incomplete last line in buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse;
        this.handleMessage(msg);
      } catch {
        // Not valid JSON — could be a log line from the server, ignore
        console.log(`[MCP stdout] ${trimmed.slice(0, 200)}`);
      }
    }
  }

  private handleMessage(msg: JsonRpcResponse): void {
    if (msg.id === undefined || msg.id === null) {
      // Server notification — log and ignore
      return;
    }

    const entry = this.pending.get(msg.id);
    if (!entry) {
      console.warn(`[MCP] Response for unknown id=${msg.id}`);
      return;
    }

    this.pending.delete(msg.id);
    clearTimeout(entry.timer);

    if (msg.error) {
      entry.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
    } else {
      entry.resolve(msg.result);
    }
  }

  private rejectAllPending(err: Error): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    this.pending.clear();
  }
}

/** Singleton MCP client instance */
export const mcpClient = new McpClient();
