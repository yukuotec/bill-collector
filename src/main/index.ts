import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { closeDatabase, initDatabase } from './database';
import { setupIpcHandlers } from './ipc';
import { initializeReminders, stopReminders } from './reminders';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Set a flag in the renderer that we're in Electron
  mainWindow.webContents.executeJavaScript(`window.__IS_ELECTRON = true;`);

  // Initialize reminders system
  initializeReminders(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await initDatabase();
  setupIpcHandlers(ipcMain, dialog);
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
  stopReminders();
  closeDatabase();
});
