export interface Settings {
  hotkeyAccelerator: string;
  hotkeyMode: 'toggle' | 'push-to-talk';
  modelName: string;
  language: string;
  autoCopyToClipboard: boolean;
  showFloatingWidget: boolean;
  launchAtStartup: boolean;
  silenceDurationMs: number;
  widgetPosition: { x: number; y: number } | null;
  onboardingComplete: boolean;
}

export interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: number;
  durationMs: number;
  modelName: string;
}

export interface TranscriptionResult {
  text: string;
  durationMs: number;
}

export interface DownloadProgress {
  modelName: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speedBps: number;
}

// Main → Renderer message types
export interface TranscriptionStatusMessage {
  status: 'transcribing' | 'complete' | 'error';
  text?: string;
  error?: string;
}

export type DownloadProgressMessage = DownloadProgress;

// Renderer → Main message types
export interface TranscribeRequest {
  wavBuffer: ArrayBuffer;
}

export type SettingsUpdateRequest = Partial<Settings>;

export interface WidgetPositionRequest {
  x: number;
  y: number;
}
