import {
  PublicClientApplication,
  Configuration,
  AccountInfo,
  InteractiveRequest,
  CryptoProvider,
} from '@azure/msal-node';
import { shell, BrowserWindow } from 'electron';
import * as http from 'http';
import * as url from 'url';

// Power BI Desktop's well-known public client ID
const PBI_CLIENT_ID = '7f67af8a-fedc-4b08-8b4e-37c4d127b6cf';
const AUTHORITY = 'https://login.microsoftonline.com/organizations';
const SCOPES = ['https://analysis.windows.net/powerbi/api/.default'];
const REDIRECT_PORT = 38471;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

const MSAL_CONFIG: Configuration = {
  auth: { clientId: PBI_CLIENT_ID, authority: AUTHORITY },
};

let pca: PublicClientApplication | null = null;
let cachedAccount: AccountInfo | null = null;
const cryptoProvider = new CryptoProvider();

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

function listenForAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const query = url.parse(req.url || '', true).query;
      const code = query.code as string | undefined;
      const error = query.error as string | undefined;

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Signed in to PQ Workbench!</h2><p>You can close this tab.</p></body></html>');
        server.close();
        resolve(code);
      } else {
        const desc = (query.error_description as string) || error || 'Unknown error';
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Sign-in failed</h2><p>${desc}</p></body></html>`);
        server.close();
        reject(new Error(`Auth error: ${desc}`));
      }
    });
    server.listen(REDIRECT_PORT);
    server.on('error', reject);
    setTimeout(() => {
      server.close();
      reject(new Error('Sign-in timed out after 2 minutes'));
    }, 120_000);
  });
}

export async function signIn(): Promise<AuthStatus> {
  const client = getClient();
  const { verifier, challenge } = await cryptoProvider.generatePkceCodes();

  const authCodeUrl = await client.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
  });

  // Start listening for redirect before opening browser
  const codePromise = listenForAuthCode();

  // Open system browser
  await shell.openExternal(authCodeUrl);

  // Wait for the code
  const code = await codePromise;

  const result = await client.acquireTokenByCode({
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
    code,
    codeVerifier: verifier,
  });

  cachedAccount = result.account ?? null;
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
    // Silent failed — re-auth via interactive
    const result = await signIn();
    if (!result.signedIn) throw new Error('Re-authentication failed');
    return (await client.acquireTokenSilent({
      scopes: SCOPES,
      account: cachedAccount!,
    })).accessToken;
  }
}

export async function pollAuthCompletion(): Promise<AuthStatus> {
  return getStatus();
}
