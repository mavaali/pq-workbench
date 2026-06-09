import { mcpClient, McpClient } from './mcp-client';

export interface AuthStatus {
  signedIn: boolean;
  userName?: string;
  tenantId?: string;
}

export async function signIn(): Promise<AuthStatus> {
  // Interactive AAD auth — opens browser via MCP server
  const result = await mcpClient.callTool('authenticate_interactive', {}, 120_000);
  return parseAuthStatus(result);
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
