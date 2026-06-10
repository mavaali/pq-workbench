import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 60_000;

export type LlmProvider = 'gh-copilot' | 'claude';

export interface LlmResult {
  mCode: string;
  rawOutput: string;
}

export interface LlmAvailability {
  'gh-copilot': boolean;
  claude: boolean;
}

async function which(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('/usr/bin/which', [cmd], { timeout: 5_000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function checkAvailability(): Promise<LlmAvailability> {
  const [copilot, claude] = await Promise.all([which('copilot'), which('claude')]);
  return {
    'gh-copilot': copilot !== null,
    claude: claude !== null,
  };
}

export async function generateMCode(
  provider: LlmProvider,
  prompt: string,
  context?: string[]
): Promise<LlmResult> {
  const fullPrompt = buildPrompt(prompt, context);

  let bin: string;
  let args: string[];

  if (provider === 'gh-copilot') {
    const copilotPath = await which('copilot');
    if (!copilotPath) throw new Error('GitHub Copilot CLI not found. Install from: https://gh.io/copilot-cli');
    bin = copilotPath;
    args = ['-p', fullPrompt, '--no-confirmations'];
  } else {
    const claudePath = await which('claude');
    if (!claudePath) throw new Error('Claude CLI not found. Install from: https://docs.anthropic.com/en/docs/claude-cli');
    bin = claudePath;
    args = ['-p', fullPrompt, '--output-format', 'text'];
  }

  try {
    const { stdout } = await execFileAsync(bin, args, {
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });
    const mCode = extractMCode(stdout);
    return { mCode, rawOutput: stdout };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`LLM (${provider}) failed: ${message}`);
  }
}

function buildPrompt(prompt: string, context?: string[]): string {
  let full = `Generate Power Query M code for the following request. Return ONLY the M code inside a code block, no explanation.\n\nRequest: ${prompt}`;
  if (context && context.length > 0) {
    full += `\n\nAvailable tables and columns in this workspace:\n${context.join('\n')}`;
  }
  return full;
}

function extractMCode(raw: string): string {
  // Try to extract from markdown code block
  const match = raw.match(/```(?:m|powerquery|pq)?\s*\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  // Try to find a let...in block
  const letIn = raw.match(/(let[\s\S]*?in[\s\S]*?)(?:$|```)/i);
  if (letIn) return letIn[1].trim();
  return raw.trim();
}
