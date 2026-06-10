import {
  PublicClientApplication,
  Configuration,
  AccountInfo,
  DeviceCodeRequest,
} from '@azure/msal-node';
import { BrowserWindow } from 'electron';

// Power BI Desktop's well-known public client ID — preauthorized in all MSFT tenants
const PBI_CLIENT_ID = '7f67af8a-fedc-4b08-8b4e-37c4d127b6cf';
const AUTHORITY = 'https://login.microsoftonline.com/organizations';
const SCOPES = ['https://analysis.windows.net/powerbi/api/.default'];

const MSAL_CONFIG: Configuration = {
  auth: { clientId: PBI_CLIENT_ID, authority: AUTHORITY },
};

let pca: PublicClientApplication | null = null;
let cachedAccount: AccountInfo | null = null;

function getClient(): PublicClientApplication {
  if (!pca) pca = new PublicClientApplication(MSAL_CONFIG);
  return pca;
}

export interface AuthStatus {
  signedIn: boolean;
  userName?: string;
  tenantId?: string;
  deviceCode?: string;
  verificationUrl?: string;
}

export async function signIn(): Promise<AuthStatus> {
  const client = getClient();

  const deviceCodeRequest: DeviceCodeRequest = {
    scopes: SCOPES,
    deviceCodeCallback: (response) => {
      console.log(`[Auth] Device code: ${response.userCode}`);
      console.log(`[Auth] URL: ${response.verificationUri}`);
      // Send code to all renderer windows
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('auth:device-code', {
          userCode: response.userCode,
          verificationUri: response.verificationUri,
          message: response.message,
        });
      }
    },
  };

  const result = await client.acquireTokenByDeviceCode(deviceCodeRequest);
  cachedAccount = result?.account ?? null;

  return {
    signedIn: true,
    userName: cachedAccount?.name ?? cachedAccount?.username,
    tenantId: cachedAccount?.tenantId,
  };
}

export async function signOut(): Promise<void> {
  const client = getClient();
  if (cachedAccount) {
    const cache = client.getTokenCache();
    const accounts = await cache.getAllAccounts();
    for (const acct of accounts) {
      await cache.removeAccount(acct);
    }
  }
  cachedAccount = null;
}

export async function getStatus(): Promise<AuthStatus> {
  if (!cachedAccount) {
    // Check if we have a cached account from a previous token acquisition
    const client = getClient();
    const accounts = await client.getTokenCache().getAllAccounts();
    if (accounts.length > 0) {
      cachedAccount = accounts[0];
      return {
        signedIn: true,
        userName: cachedAccount.name ?? cachedAccount.username,
        tenantId: cachedAccount.tenantId,
      };
    }
    return { signedIn: false };
  }
  return {
    signedIn: true,
    userName: cachedAccount.name ?? cachedAccount.username,
    tenantId: cachedAccount.tenantId,
  };
}

export async function getToken(): Promise<string> {
  const client = getClient();
  if (!cachedAccount) throw new Error('Not signed in');

  try {
    const result = await client.acquireTokenSilent({
      scopes: SCOPES,
      account: cachedAccount,
    });
    return result.accessToken;
  } catch {
    // Silent failed — need re-auth
    throw new Error('Token expired. Please sign in again.');
  }
}

export async function pollAuthCompletion(): Promise<AuthStatus> {
  // Not needed anymore — signIn() blocks until device code is completed
  return getStatus();
}
