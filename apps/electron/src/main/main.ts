import {
  app,
  BrowserWindow,
  Tray,
  globalShortcut,
  ipcMain,
  clipboard,
  screen,
  session,
} from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import { IpcChannel } from '../shared/ipc-channels';
import type { Settings, TranscriptEntry } from '../shared/types';
import { WhisperService } from './whisper-service';
import { ModelManager } from './model-manager';
import { ClipboardManager } from './clipboard-manager';
import { SettingsStore } from './settings-store';
import { HistoryStore } from './history-store';
import { TrayManager } from './tray-manager';

// ── Stores & Services ───────────────────────────────────────────────────────

const settingsStoreInstance = new SettingsStore();
const historyStoreInstance = new HistoryStore();
const modelManager = new ModelManager();
const whisperService = new WhisperService();
const clipboardManager = new ClipboardManager();
const trayManager = new TrayManager();

// Keep a reference to the raw electron-store for direct access where needed
const settingsStore = new Store<Settings>({
  name: 'settings',
  defaults: {
    hotkeyAccelerator: process.platform === 'darwin' ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space',
    hotkeyMode: 'toggle' as const,
    modelName: 'base.en',
    language: 'en',
    autoCopyToClipboard: true,
    showFloatingWidget: true,
    launchAtStartup: false,
    silenceDurationMs: 1500,
    widgetPosition: null,
    onboardingComplete: false,
  },
});

// ── Window references ───────────────────────────────────────────────────────

let widgetWindow: BrowserWindow | null = null;
let recorderWindow: BrowserWindow | null = null;
let onboardingWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// ── Window creation ─────────────────────────────────────────────────────────

function createFloatingWidget(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const savedPosition = settingsStore.get('widgetPosition');
  const x = savedPosition ? savedPosition.x : Math.round(screenWidth / 2 - 100);
  const y = savedPosition ? savedPosition.y : screenHeight - 60;

  const preloadPath = path.join(__dirname, '..', 'preload', 'preload.js');
  console.log('[Main] Preload path:', preloadPath, 'exists:', fs.existsSync(preloadPath));

  const win = new BrowserWindow({
    width: 160,
    height: 48,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      webSecurity: false,
    },
  });

  const widgetHtmlPath = path.join(__dirname, '..', 'renderer', 'widget', 'widget.html');
  win.loadFile(widgetHtmlPath);

  // Persist position when the window is moved (dragged)
  win.on('moved', () => {
    const [wx, wy] = win.getPosition();
    settingsStore.set('widgetPosition', { x: wx, y: wy });
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  return win;
}

function createRecorderWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  const recorderHtmlPath = path.join(__dirname, '..', 'renderer', 'recorder', 'recorder.html');
  win.loadFile(recorderHtmlPath);

  return win;
}

function createOnboardingWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 600,
    height: 700,
    center: true,
    resizable: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const onboardingHtmlPath = path.join(__dirname, '..', 'renderer', 'onboarding', 'onboarding.html');
  win.loadFile(onboardingHtmlPath);

  win.on('closed', () => {
    onboardingWindow = null;
  });

  return win;
}

function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 500,
    height: 450,
    center: true,
    resizable: false,
    frame: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const settingsHtmlPath = path.join(__dirname, '..', 'renderer', 'settings', 'settings.html');
  win.loadFile(settingsHtmlPath);

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  return win;
}

// ── System Tray ─────────────────────────────────────────────────────────────

function initTray(): Tray {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
  return trayManager.create(iconPath, {
    onSettings: () => {
      if (!settingsWindow) {
        settingsWindow = createSettingsWindow();
      }
      settingsWindow.show();
      settingsWindow.focus();
    },
    onHistory: () => {
      // History window will be implemented in later tasks
    },
    onQuit: () => {
      isQuitting = true;
      app.quit();
    },
  });
}

// ── Global Hotkey ───────────────────────────────────────────────────────────

let uiohookStarted = false;

function registerGlobalHotkey(accelerator: string): void {
  const mode = settingsStore.get('hotkeyMode') || 'toggle';

  // Clean up previous registrations
  globalShortcut.unregisterAll();
  stopUiohook();

  if (mode === 'push-to-talk') {
    setupPushToTalk();
  } else {
    setupToggleHotkey(accelerator);
  }
}

function setupToggleHotkey(accelerator: string): void {
  try {
    let lastToggle = 0;
    const registered = globalShortcut.register(accelerator, () => {
      const now = Date.now();
      if (now - lastToggle < 500) return;
      lastToggle = now;
      if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send(IpcChannel.TOGGLE_RECORDING);
      }
    });
    if (!registered) {
      console.warn(`Failed to register global hotkey: ${accelerator}`);
    }
  } catch (err) {
    console.warn(`Error registering global hotkey: ${err}`);
  }
}

function setupPushToTalk(): void {
  try {
    const { uIOhook, UiohookKey } = require('uiohook-napi');

    // Ctrl+Shift+Space keycodes
    let ctrlDown = false;
    let shiftDown = false;
    let spaceDown = false;
    let recording = false;

    uIOhook.on('keydown', (e: any) => {
      if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) ctrlDown = true;
      if (e.keycode === UiohookKey.Shift || e.keycode === UiohookKey.ShiftRight) shiftDown = true;
      if (e.keycode === UiohookKey.Space) spaceDown = true;

      if (ctrlDown && shiftDown && spaceDown && !recording) {
        recording = true;
        console.log('[PTT] Start recording');
        if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.webContents.send('start-recording');
        }
      }
    });

    uIOhook.on('keyup', (e: any) => {
      if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) ctrlDown = false;
      if (e.keycode === UiohookKey.Shift || e.keycode === UiohookKey.ShiftRight) shiftDown = false;
      if (e.keycode === UiohookKey.Space) spaceDown = false;

      if (recording && (!ctrlDown || !shiftDown || !spaceDown)) {
        recording = false;
        console.log('[PTT] Stop recording');
        if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.webContents.send('stop-recording');
        }
      }
    });

    uIOhook.start();
    uiohookStarted = true;
    console.log('[PTT] Push-to-talk mode active');
  } catch (err) {
    console.warn('[PTT] Failed to start uiohook:', err);
    // Fall back to toggle mode
    const accelerator = settingsStore.get('hotkeyAccelerator');
    setupToggleHotkey(accelerator);
  }
}

function stopUiohook(): void {
  if (uiohookStarted) {
    try {
      const { uIOhook } = require('uiohook-napi');
      uIOhook.stop();
    } catch (e) {}
    uiohookStarted = false;
  }
}

// ── IPC Handlers ────────────────────────────────────────────────────────────

function setupIPC(): void {
  ipcMain.handle(IpcChannel.GET_SETTINGS, () => {
    return settingsStore.store;
  });

  ipcMain.handle(IpcChannel.UPDATE_SETTINGS, (_event, partial: Partial<Settings>) => {
    for (const [key, value] of Object.entries(partial)) {
      settingsStore.set(key as keyof Settings, value);
    }
    // Re-register hotkey if it changed
    if (partial.hotkeyAccelerator) {
      registerGlobalHotkey(partial.hotkeyAccelerator);
    }
  });

  ipcMain.handle(IpcChannel.GET_HISTORY, () => {
    return historyStoreInstance.getEntries();
  });

  ipcMain.handle(IpcChannel.CLEAR_HISTORY, () => {
    historyStoreInstance.clearHistory();
  });

  ipcMain.handle(IpcChannel.COPY_TO_CLIPBOARD, (_event, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.handle(IpcChannel.WIDGET_POSITION_SAVE, (_event, position: { x: number; y: number }) => {
    settingsStore.set('widgetPosition', position);
  });

  ipcMain.handle(IpcChannel.WIDGET_POSITION_LOAD, () => {
    return settingsStore.get('widgetPosition');
  });

  ipcMain.handle(IpcChannel.IS_ONBOARDING_DONE, () => {
    return settingsStore.get('onboardingComplete');
  });

  ipcMain.handle(IpcChannel.ONBOARDING_COMPLETE, () => {
    settingsStore.set('onboardingComplete', true);
    if (onboardingWindow) {
      onboardingWindow.destroy();
      onboardingWindow = null;
    }
  });

  ipcMain.handle(IpcChannel.OPEN_SETTINGS, () => {
    if (!settingsWindow) {
      settingsWindow = createSettingsWindow();
    }
    settingsWindow.show();
    settingsWindow.focus();
  });

  ipcMain.handle(IpcChannel.QUIT_APP, () => {
    isQuitting = true;
    app.quit();
  });

  // Transcribe handler
  ipcMain.handle(IpcChannel.TRANSCRIBE, async (_event, wavBuffer: ArrayBuffer) => {
    try {
      // Notify widget: transcribing
      if (widgetWindow) {
        widgetWindow.webContents.send(IpcChannel.TRANSCRIPTION_STATUS, { status: 'transcribing' });
      }

      // Initialize whisper service if needed
      if (!whisperService.isInitialized()) {
        await whisperService.initialize();
      }

      // Write WAV buffer to temp file
      const tmpFile = path.join(os.tmpdir(), `vtt-${Date.now()}.wav`);
      fs.writeFileSync(tmpFile, Buffer.from(wavBuffer));

      try {
        const result = await whisperService.transcribe(tmpFile);

        // Auto-copy to clipboard if enabled
        if (result.text && settingsStore.get('autoCopyToClipboard')) {
          clipboardManager.copyText(result.text);
        }

        // Save to history if non-empty
        if (result.text) {
          const entry: TranscriptEntry = {
            id: uuidv4(),
            text: result.text,
            timestamp: Date.now(),
            durationMs: result.durationMs,
            modelName: settingsStore.get('modelName'),
          };
          historyStoreInstance.addEntry(entry);
        }

        // Notify widget: complete
        if (widgetWindow) {
          widgetWindow.webContents.send(IpcChannel.TRANSCRIPTION_STATUS, {
            status: 'complete',
            text: result.text,
          });
        }

        return result;
      } finally {
        // Clean up temp file
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (widgetWindow) {
        widgetWindow.webContents.send(IpcChannel.TRANSCRIPTION_STATUS, {
          status: 'error',
          error: errorMsg,
        });
      }
      throw err;
    }
  });

  // Download model handler
  ipcMain.handle(IpcChannel.DOWNLOAD_MODEL, async (_event, _modelName: string) => {
    // Actually load the Whisper model — this downloads ONNX files on first run
    try {
      await whisperService.initialize((progressData: any) => {
        // transformers.js sends: { status: 'download', progress: 50, file: 'model.onnx' }
        const progress = {
          modelName: 'whisper-base.en',
          bytesDownloaded: 0,
          totalBytes: 0,
          percentage: Math.round(progressData.progress || 0),
          speedBps: 0,
        };
        if (onboardingWindow && !onboardingWindow.isDestroyed()) {
          onboardingWindow.webContents.send(IpcChannel.DOWNLOAD_PROGRESS, progress);
        }
        console.log(`[Model] ${progressData.status}: ${progressData.file || ''} ${Math.round(progressData.progress || 0)}%`);
      });
    } catch (err) {
      console.error('[Model] Download/load failed:', err);
      throw err;
    }
  });
}

// ── App Lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Grant microphone permission automatically
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(true);
    }
  });

  setupIPC();

  widgetWindow = createFloatingWidget();
  tray = initTray();

  const hotkey = settingsStore.get('hotkeyAccelerator');
  registerGlobalHotkey(hotkey);

  // Show onboarding on first launch
  const onboardingDone = settingsStore.get('onboardingComplete');
  if (!onboardingDone) {
    onboardingWindow = createOnboardingWindow();
    onboardingWindow.show();
  }
});

app.on('window-all-closed', () => {
  // Don't quit — keep running in tray
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopUiohook();
});

app.on('activate', () => {
  // macOS: re-show widget when dock icon is clicked
  if (widgetWindow && !widgetWindow.isVisible()) {
    widgetWindow.show();
  }
});

