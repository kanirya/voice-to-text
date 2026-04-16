import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel } from '../shared/ipc-channels';
import type {
  TranscriptionResult,
  Settings,
  TranscriptEntry,
  DownloadProgress,
  TranscriptionStatusMessage,
} from '../shared/types';

const electronAPI = {
  transcribe(wavBuffer: ArrayBuffer): Promise<TranscriptionResult> {
    return ipcRenderer.invoke(IpcChannel.TRANSCRIBE, wavBuffer);
  },

  onTranscriptionStatus(callback: (message: TranscriptionStatusMessage) => void): void {
    ipcRenderer.on(IpcChannel.TRANSCRIPTION_STATUS, (_event, message) => callback(message));
  },

  onToggleRecording(callback: () => void): void {
    ipcRenderer.on(IpcChannel.TOGGLE_RECORDING, () => callback());
  },

  getSettings(): Promise<Settings> {
    return ipcRenderer.invoke(IpcChannel.GET_SETTINGS);
  },

  updateSettings(settings: Partial<Settings>): Promise<void> {
    return ipcRenderer.invoke(IpcChannel.UPDATE_SETTINGS, settings);
  },

  getHistory(): Promise<TranscriptEntry[]> {
    return ipcRenderer.invoke(IpcChannel.GET_HISTORY);
  },

  clearHistory(): Promise<void> {
    return ipcRenderer.invoke(IpcChannel.CLEAR_HISTORY);
  },

  copyToClipboard(text: string): Promise<void> {
    return ipcRenderer.invoke(IpcChannel.COPY_TO_CLIPBOARD, text);
  },

  downloadModel(modelName: string): Promise<void> {
    return ipcRenderer.invoke(IpcChannel.DOWNLOAD_MODEL, modelName);
  },

  onDownloadProgress(callback: (progress: DownloadProgress) => void): void {
    ipcRenderer.on(IpcChannel.DOWNLOAD_PROGRESS, (_event, progress) => callback(progress));
  },

  saveWidgetPosition(position: { x: number; y: number }): Promise<void> {
    return ipcRenderer.invoke(IpcChannel.WIDGET_POSITION_SAVE, position);
  },

  loadWidgetPosition(): Promise<{ x: number; y: number } | null> {
    return ipcRenderer.invoke(IpcChannel.WIDGET_POSITION_LOAD);
  },

  isOnboardingDone(): Promise<boolean> {
    return ipcRenderer.invoke(IpcChannel.IS_ONBOARDING_DONE);
  },

  completeOnboarding(): Promise<void> {
    return ipcRenderer.invoke(IpcChannel.ONBOARDING_COMPLETE);
  },

  openSettings(): Promise<void> {
    return ipcRenderer.invoke(IpcChannel.OPEN_SETTINGS);
  },

  quitApp(): Promise<void> {
    return ipcRenderer.invoke(IpcChannel.QUIT_APP);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
