import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc';
import { mcpClient } from './mcp-client';

const isDev = !app.isPackaged;

function createWindow(): void {
  const preloadPath = path.join(__dirname, '..', 'preload', 'preload.js');

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'PQ Workbench',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      devTools: isDev,
      preload: preloadPath,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:9000');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  // Notify renderer of MCP connection status changes
  mcpClient.on('connected', () => {
    win.webContents.send('mcp:status', { connected: true });
  });
  mcpClient.on('disconnected', (reason: string) => {
    win.webContents.send('mcp:status', { connected: false, reason });
  });
}

app.whenReady().then(async () => {
  registerIpcHandlers();

  // Start MCP server — don't block window creation on it
  mcpClient.start().then(() => {
    console.log('[PQ Workbench] MCP server connected');
  }).catch((err) => {
    console.error('[PQ Workbench] MCP server failed to start:', err.message);
    // The app still works — MCP calls will attempt reconnection on demand
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  mcpClient.stop();
});
