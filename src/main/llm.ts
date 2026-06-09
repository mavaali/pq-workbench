import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 30_000;

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
  const [gh, claude] = await Promise.all([which('gh'), which('claude')]);
  return {
    'gh-copilot': gh !== null,
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
    const ghPath = await which('gh');
    if (!ghPath) throw new Error('gh CLI not found');
    bin = ghPath;
    args = ['copilot', 'suggest', '-t', 'shell', fullPrompt];
  } else {
    const claudePath = await which('claude');
    if (!claudePath) throw new Error('claude CLI not found');
    bin = claudePath;
    args = ['--print', fullPrompt];
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
  let full = `Generate Power Query M code for the following request:\n${prompt}`;
  if (context && context.length > 0) {
    full += `\n\nContext (available tables/columns):\n${context.join('\n')}`;
  }
  full += '\n\nRespond with ONLY the M code, no explanation.';
  return full;
}

function extractMCode(raw: string): string {
  // Try to extract from markdown code block
  const match = raw.match(/```(?:m|powerquery)?\s*\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  return raw.trim();
}
