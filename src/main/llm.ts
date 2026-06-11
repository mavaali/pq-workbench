import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 60_000;

export type LlmProvider = 'gh-copilot' | 'claude';

export interface LlmResult {
  mCode: string;
  rawOutput: string;
}

export type AuthState = 'authenticated' | 'unauthenticated' | 'unknown';

export interface LlmProviderStatus {
  cliInstalled: boolean;
  auth: AuthState;
}

export type LlmAvailability = Record<LlmProvider, LlmProviderStatus>;

async function which(cmd: string): Promise<string | null> {
  try {
    const isWin = process.platform === 'win32';
    const bin = isWin ? 'where.exe' : '/usr/bin/which';
    const { stdout } = await execFileAsync(bin, [cmd], { timeout: 5_000 });
    return stdout.trim().split('\n')[0] || null;
  } catch {
    return null;
  }
}

/**
 * Probe whether the GitHub Copilot CLI has a stored credential.
 *  - macOS: `copilot login --help` documents that the token lives in the system
 *    credential store, service name "GitHub Copilot CLI". We query Keychain
 *    directly with `security find-generic-password`.
 *  - Fallback file (per the CLI's own help text): `~/.copilot/auth.json` if
 *    Keychain wasn't available at login time.
 *  - Env override: GH_TOKEN / GITHUB_TOKEN.
 *  - Other platforms: best-effort fallback file only; otherwise `unknown`.
 */
async function probeCopilotAuth(): Promise<AuthState> {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return 'authenticated';

  const fallbackFile = join(homedir(), '.copilot', 'auth.json');
  if (existsSync(fallbackFile)) return 'authenticated';

  if (process.platform === 'darwin') {
    try {
      await execFileAsync(
        '/usr/bin/security',
        ['find-generic-password', '-s', 'copilot-cli'],
        { timeout: 3_000 },
      );
      return 'authenticated';
    } catch (err: unknown) {
      // Exit 44 = not found, other non-zero = some other error
      const code = (err as { code?: number }).code;
      if (code === 44) return 'unauthenticated';
      return 'unknown';
    }
  }

  return 'unknown';
}

/**
 * Probe Claude CLI authentication via the well-known credential file. Claude
 * CLI also supports an ANTHROPIC_API_KEY env override.
 */
async function probeClaudeAuth(): Promise<AuthState> {
  if (process.env.ANTHROPIC_API_KEY) return 'authenticated';

  const candidates = [
    join(homedir(), '.claude', '.credentials.json'),
    join(homedir(), '.config', 'claude', '.credentials.json'),
  ];
  if (candidates.some((p) => existsSync(p))) return 'authenticated';

  return 'unknown';
}

export async function checkAvailability(): Promise<LlmAvailability> {
  const [copilot, claude] = await Promise.all([which('copilot'), which('claude')]);

  const [copilotAuth, claudeAuth] = await Promise.all([
    copilot ? probeCopilotAuth() : Promise.resolve<AuthState>('unauthenticated'),
    claude ? probeClaudeAuth() : Promise.resolve<AuthState>('unauthenticated'),
  ]);

  return {
    'gh-copilot': { cliInstalled: copilot !== null, auth: copilotAuth },
    claude: { cliInstalled: claude !== null, auth: claudeAuth },
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
    args = ['-p', fullPrompt];
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
  // Strip Copilot CLI footer (Changes, AI Credits, Tokens lines)
  const cleaned = raw.replace(/\n\s*Changes\s+\+.*$/s, '').replace(/\n\s*AI Credits.*$/s, '').trim();
  // Try to extract from markdown code block
  const match = cleaned.match(/```(?:m|powerquery|pq)?\s*\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  // Try to find a let...in block
  const letIn = cleaned.match(/(let[\s\S]*?in[\s\S]*?)(?:$|```)/i);
  if (letIn) return letIn[1].trim();
  return cleaned.trim();
}
