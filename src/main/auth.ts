import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const FABRIC_RESOURCE = 'https://api.fabric.microsoft.com';

export interface AuthStatus {
  signedIn: boolean;
  userName?: string;
  tenantId?: string;
}

interface AzTokenResponse {
  accessToken: string;
  expiresOn: string;
  tenant: string;
}

interface AzAccountResponse {
  user: { name: string; type: string };
  tenantId: string;
  name: string;
}

async function azPath(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('/usr/bin/which', ['az'], { timeout: 5_000 });
    return stdout.trim();
  } catch {
    throw new Error('Azure CLI (az) not found. Install from https://aka.ms/install-az-cli');
  }
}

export async function signIn(): Promise<AuthStatus> {
  const az = await azPath();
  // Check if already logged in
  try {
    const status = await getStatus();
    if (status.signedIn) return status;
  } catch { /* not logged in */ }

  // Launch interactive login
  await execFileAsync(az, ['login', '--output', 'none'], { timeout: 120_000 });
  return getStatus();
}

export async function signOut(): Promise<void> {
  const az = await azPath();
  await execFileAsync(az, ['logout'], { timeout: 10_000 }).catch(() => {});
}

export async function getStatus(): Promise<AuthStatus> {
  try {
    const az = await azPath();
    const { stdout } = await execFileAsync(
      az,
      ['account', 'show', '--output', 'json'],
      { timeout: 10_000 }
    );
    const account: AzAccountResponse = JSON.parse(stdout);
    return {
      signedIn: true,
      userName: account.user?.name,
      tenantId: account.tenantId,
    };
  } catch {
    return { signedIn: false };
  }
}

export async function getToken(): Promise<string> {
  const az = await azPath();
  try {
    const { stdout } = await execFileAsync(
      az,
      ['account', 'get-access-token', '--resource', FABRIC_RESOURCE, '--output', 'json'],
      { timeout: 30_000 }
    );
    const response: AzTokenResponse = JSON.parse(stdout);
    return response.accessToken;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('AADSTS') || msg.includes('Please run')) {
      throw new Error('Azure CLI session expired. Click Sign In to re-authenticate.');
    }
    throw new Error(`Failed to get Fabric token: ${msg}`);
  }
}
