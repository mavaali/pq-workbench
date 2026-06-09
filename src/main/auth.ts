import {
  PublicClientApplication,
  Configuration,
  AuthenticationResult,
  AccountInfo,
} from '@azure/msal-node';

const MSAL_CONFIG: Configuration = {
  auth: {
    clientId: process.env.PQ_WORKBENCH_CLIENT_ID || '00000000-0000-0000-0000-000000000000',
    authority: 'https://login.microsoftonline.com/organizations',
  },
};

const FABRIC_SCOPES = ['https://api.fabric.microsoft.com/.default'];

let pca: PublicClientApplication | null = null;
let cachedAccount: AccountInfo | null = null;

function getClient(): PublicClientApplication {
  if (!pca) {
    pca = new PublicClientApplication(MSAL_CONFIG);
  }
  return pca;
}

export interface AuthStatus {
  signedIn: boolean;
  userName?: string;
  tenantId?: string;
}

export async function signIn(): Promise<AuthStatus> {
  const client = getClient();
  const result: AuthenticationResult = await client.acquireTokenInteractive({
    scopes: FABRIC_SCOPES,
    openBrowser: async () => {
      // Electron will handle the redirect
    },
  });
  cachedAccount = result.account;
  return {
    signedIn: true,
    userName: result.account?.name ?? result.account?.username,
    tenantId: result.account?.tenantId,
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
    return { signedIn: false };
  }
  return {
    signedIn: true,
    userName: cachedAccount.name ?? cachedAccount.username,
    tenantId: cachedAccount.tenantId,
  };
}

export async function getToken(scopes: string[] = FABRIC_SCOPES): Promise<string> {
  const client = getClient();
  if (!cachedAccount) {
    throw new Error('Not signed in. Call signIn() first.');
  }
  try {
    const result = await client.acquireTokenSilent({
      scopes,
      account: cachedAccount,
    });
    return result.accessToken;
  } catch {
    // Fallback to interactive
    const result = await client.acquireTokenInteractive({
      scopes,
      openBrowser: async () => {},
    });
    cachedAccount = result.account;
    return result.accessToken;
  }
}
