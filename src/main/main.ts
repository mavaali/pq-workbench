import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc';

const isDev = !app.isPackaged;

function createWindow(): void {
  const preloadPath = path.join(__dirname, '..', 'preload', 'preload.js');

  const iconExt = process.platform === 'win32' ? 'ico' : process.platform === 'darwin' ? 'icns' : 'png';
  const iconPath = path.join(__dirname, '..', '..', 'assets', `icon.${iconExt}`);

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'PQ Workbench',
    icon: iconPath,
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
}

app.whenReady().then(async () => {
  registerIpcHandlers();
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
