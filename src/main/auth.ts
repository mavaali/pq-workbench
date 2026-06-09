import { mcpClient, McpClient } from './mcp-client';
import { shell } from 'electron';

export interface AuthStatus {
  signedIn: boolean;
  userName?: string;
  tenantId?: string;
  deviceCode?: string;
  verificationUrl?: string;
}

export async function signIn(): Promise<AuthStatus> {
  // Start device code flow
  const result = await mcpClient.callTool('start_device_code_auth', {}, 30_000);
  const text = McpClient.parseText(result);

  console.log('[Auth] Device code response:', text);

  // Extract device code and URL from response
  const urlMatch = text.match(/https:\/\/microsoft\.com\/devicelogin/i)
    || text.match(/https:\/\/[^\s"]+devicelogin[^\s"]*/i);
  const codeMatch = text.match(/code[:\s]+[`"'*]*([A-Z0-9]{6,12})[`"'*]*/i)
    || text.match(/\b([A-Z][A-Z0-9]{5,11})\b/);

  const verificationUrl = urlMatch ? urlMatch[0] : 'https://microsoft.com/devicelogin';
  const deviceCode = codeMatch ? codeMatch[1] : 'CHECK TERMINAL';

  // Open the verification URL in system browser
  await shell.openExternal(verificationUrl);

  // Return immediately with the device code so the UI can show it
  // The caller will need to poll for completion
  return {
    signedIn: false,
    deviceCode,
    verificationUrl,
    userName: `Enter code: ${deviceCode}`,
  };
}

export async function pollAuthCompletion(): Promise<AuthStatus> {
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const statusResult = await mcpClient.callTool('check_device_auth_status', {}, 10_000);
      const statusText = McpClient.parseText(statusResult);
      const lower = statusText.toLowerCase();

      if (lower.includes('authenticated') || lower.includes('success') || lower.includes('signed in')) {
        return getStatus();
      }
      if (lower.includes('expired') || lower.includes('denied') || lower.includes('failed')) {
        throw new Error(`Authentication failed: ${statusText}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('expired') || msg.includes('denied')) throw e;
    }
  }
  throw new Error('Authentication timed out after 2 minutes');
}

export async function signOut(): Promise<void> {
  try {
    await mcpClient.callTool('sign_out', {});
  } catch {
    // sign_out may not be implemented; ignore
  }
}

export async function getStatus(): Promise<AuthStatus> {
  try {
    const result = await mcpClient.callTool('get_authentication_status', {});
    return parseAuthStatus(result);
  } catch {
    return { signedIn: false };
  }
}

function parseAuthStatus(result: import('./mcp-client').McpToolResult): AuthStatus {
  const text = McpClient.parseText(result);

  // Try JSON first
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    return {
      signedIn: Boolean(data.authenticated ?? data.signedIn ?? data.isAuthenticated ?? true),
      userName: (data.userName ?? data.username ?? data.user ?? data.displayName) as string | undefined,
      tenantId: (data.tenantId ?? data.tenant) as string | undefined,
    };
  } catch { /* not JSON — fall through */ }

  // Heuristic: if the text contains "authenticated" or similar, treat as signed in
  const lower = text.toLowerCase();
  const signedIn = lower.includes('authenticated') || lower.includes('signed in') || lower.includes('success');
  return { signedIn, userName: signedIn ? text.split('\n')[0].slice(0, 100) : undefined };
}
