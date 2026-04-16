# Implementation Plan: Desktop Voice-to-Text

## Overview

Build a lightweight Electron desktop app at `apps/electron/` that provides always-available voice-to-text transcription using a local Whisper model (nodejs-whisper). The primary interface is a 48×48px floating widget — click to record, auto-stop on silence, transcript copied to clipboard. System tray integration, global hotkey, onboarding flow, settings, and history round out the feature set. The existing Next.js web app at `apps/desktop/` remains unchanged.

## Tasks

- [x] 1. Scaffold Electron project and core infrastructure
  - [x] 1.1 Initialize `apps/electron/` package with `package.json`, TypeScript config, and dependencies (`electron`, `electron-builder`, `nodejs-whisper`, `electron-store`, `uuid`)
    - Create `apps/electron/package.json` with scripts for dev, build, and package
    - Create `apps/electron/tsconfig.json` for main and renderer targets
    - Set up directory structure: `src/main/`, `src/renderer/`, `src/preload/`, `src/shared/`, `assets/`
    - _Requirements: 1.1, 1.2, 9.5_

  - [x] 1.2 Define shared IPC channel enum and TypeScript interfaces
    - Create `src/shared/ipc-channels.ts` with the `IpcChannel` enum
    - Create `src/shared/types.ts` with `Settings`, `TranscriptEntry`, `TranscriptionResult`, `DownloadProgress`, and IPC message types
    - _Requirements: 2.1, 4.1, 8.1_

  - [x] 1.3 Implement the preload script with typed `ElectronAPI`
    - Create `src/preload/preload.ts` exposing the `ElectronAPI` interface via `contextBridge`
    - Wire each method to the corresponding IPC channel using `ipcRenderer.invoke` and `ipcRenderer.on`
    - _Requirements: 2.1, 3.1, 4.1, 5.1_

  - [x] 1.4 Implement the main process entry point (`main.ts`)
    - Create `src/main/main.ts` that bootstraps the app: creates floating widget window, initializes tray, registers global hotkey, sets up IPC handlers, manages app lifecycle
    - On first launch show onboarding window; on subsequent launches show only floating widget and tray
    - Handle `close` event to keep app running in background (tray + widget visible)
    - Handle "Quit" to terminate Whisper service and exit
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Implement Settings Store and History Store
  - [x] 2.1 Implement Settings Store using `electron-store`
    - Create `src/main/settings-store.ts` with defaults: `hotkeyAccelerator`, `modelName`, `language`, `autoCopyToClipboard`, `showFloatingWidget`, `launchAtStartup`, `silenceDurationMs`, `widgetPosition`, `onboardingComplete`
    - Expose `get`, `set`, and `getAll` methods
    - _Requirements: 8.1, 6.2, 7.6_

  - [ ]* 2.2 Write property test for widget position persistence round-trip
    - **Property 2: Widget position persistence round-trip**
    - **Validates: Requirements 6.2**

  - [x] 2.3 Implement History Store using `electron-store`
    - Create `src/main/history-store.ts` with `addEntry`, `getEntries`, `clearHistory`
    - Enforce max 100 entries, evict oldest when exceeded
    - Return entries in reverse chronological order (descending timestamp)
    - _Requirements: 11.1, 11.2, 11.4_

  - [ ]* 2.4 Write property test for history store bounded reverse-chronological order
    - **Property 3: History store maintains bounded reverse-chronological order**
    - **Validates: Requirements 11.1, 11.2**

  - [ ]* 2.5 Write property test for history persistence round-trip
    - **Property 4: History persistence round-trip**
    - **Validates: Requirements 11.4**

- [x] 3. Implement Audio Capture, VAD, and WAV Encoder
  - [x] 3.1 Implement the WAV encoder
    - Create `src/renderer/audio/wav-encoder.ts` as a pure function: `encodeWav(samples: Float32Array, options: WavEncoderOptions): ArrayBuffer`
    - Generate correct WAV header (RIFF, fmt, data chunks) for 16kHz mono 16-bit PCM
    - _Requirements: 2.1, 3.1_

  - [ ]* 3.2 Write unit tests for WAV encoder
    - Test correct header bytes, sample encoding, various sample rates
    - _Requirements: 2.1_

  - [x] 3.3 Implement the AudioWorklet VAD processor
    - Create `src/renderer/audio/vad-processor.ts` as an `AudioWorkletProcessor`
    - Compute RMS energy per frame, accumulate PCM samples, track silence duration
    - Post `silence-detected` message when energy stays below threshold for configured duration (default 1.5s)
    - _Requirements: 3.2_

  - [ ]* 3.4 Write property test for silence detection
    - **Property 1: Silence detection triggers on sustained low energy**
    - **Validates: Requirements 3.2**

  - [x] 3.5 Implement the Audio Capture module
    - Create `src/renderer/audio/audio-capture.ts` implementing `AudioCapture` interface
    - Use `navigator.mediaDevices.getUserMedia` to capture mic audio
    - Connect to `AudioWorkletProcessor` for VAD and PCM collection
    - Downsample from device native rate to 16kHz
    - Handle microphone permission errors with user-friendly messages
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 4. Checkpoint — Core audio pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Whisper Service and Model Manager
  - [x] 5.1 Implement Model Manager
    - Create `src/main/model-manager.ts` with `downloadModel`, `verifyModel`, `isModelDownloaded`, `deleteModel`, `getDownloadedModels`
    - Store models in `app.getPath('userData')/models/`
    - Download from HuggingFace URL pattern with progress callback
    - Support download resume via HTTP Range header
    - Verify integrity with SHA256 checksum after download
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 5.2 Write property test for download resume byte offset
    - **Property 5: Download resume uses correct byte offset**
    - **Validates: Requirements 12.3**

  - [ ]* 5.3 Write property test for SHA256 checksum verification
    - **Property 6: SHA256 checksum verification**
    - **Validates: Requirements 12.4**

  - [x] 5.4 Implement Whisper Service
    - Create `src/main/whisper-service.ts` wrapping `nodejs-whisper`
    - Implement `initialize`, `transcribe`, `isModelAvailable`, `getAvailableModels`
    - Accept WAV file path, return `TranscriptionResult` with text and duration
    - Handle missing/corrupted model errors, transcription timeout (30s), empty transcript
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Implement Floating Widget UI
  - [x] 6.1 Create the floating widget window configuration
    - Create frameless, always-on-top, transparent `BrowserWindow` with `skipTaskbar: true`, 48×48px
    - Make widget draggable, persist position to settings store on drag end, restore on launch
    - _Requirements: 6.1, 6.2_

  - [x] 6.2 Implement widget UI states and animations
    - Create `src/renderer/widget/widget.html` and `src/renderer/widget/widget.tsx` (or vanilla HTML/CSS/JS)
    - Idle state: microphone icon with subtle pulse animation
    - Recording state: animated pulsing ring with color change
    - Transcribing state: spinner indicator
    - Done state: checkmark flash for 1.5 seconds
    - Use dark theme (#0a0a0f background, white text), smooth transitions ≥200ms
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6, 10.1, 10.2, 10.3_

  - [x] 6.3 Wire widget click and right-click interactions
    - Left-click toggles recording session (start if idle, stop if recording)
    - Right-click shows context menu: "History", "Settings", "Quit"
    - Connect to audio capture module and IPC for transcription flow
    - _Requirements: 6.5, 6.7, 3.1, 3.3_

- [x] 7. Implement Clipboard Manager and Transcription Flow
  - [x] 7.1 Implement clipboard copy and notification
    - Create `src/main/clipboard-manager.ts` using Electron's `clipboard.writeText`
    - On transcription complete: auto-copy to clipboard (if enabled in settings), save to history, notify widget
    - Widget shows confirmation notification for 2 seconds
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.2 Wire the full recording → transcription → clipboard flow via IPC
    - Widget click/hotkey → start audio capture → VAD silence detection → stop capture → encode WAV → send to main via IPC → Whisper transcribe → copy to clipboard → update widget state → save to history
    - Show "Transcribing…" indicator during processing
    - _Requirements: 2.1, 2.3, 3.1, 3.2, 4.1, 4.2_

- [ ] 8. Checkpoint — End-to-end transcription flow
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Global Hotkey and Tray Manager
  - [x] 9.1 Implement Tray Manager
    - Create `src/main/tray-manager.ts` with `create`, `updateMenu`, `destroy`
    - Context menu: "Settings", "History", "Quit"
    - Update menu state based on recording status
    - _Requirements: 1.5, 1.6_

  - [x] 9.2 Implement Global Hotkey Manager
    - Register configurable global shortcut (default: `Ctrl+Shift+Space` / `Cmd+Shift+Space` on macOS)
    - Toggle recording session on hotkey press
    - Update widget visual state when hotkey triggers recording
    - Handle registration failure gracefully (log warning, suggest alternative)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 10. Implement Onboarding Flow
  - [x] 10.1 Create onboarding window and UI
    - Create `src/renderer/onboarding/` with welcome page, microphone permission step, model download step, and summary page
    - Welcome page explains app features
    - Microphone permission step requests OS mic access
    - Model download step shows progress bar with percentage and ETA
    - Summary page shows configured hotkey and widget usage instructions
    - Use dark theme consistent with widget
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 10.1, 10.4_

  - [x] 10.2 Wire onboarding completion and persistence
    - Persist onboarding completion state to settings store
    - Skip onboarding on subsequent launches
    - After onboarding, minimize to floating widget
    - _Requirements: 7.6, 1.1, 1.2_

- [x] 11. Implement Settings Window
  - [x] 11.1 Create settings window UI
    - Create `src/renderer/settings/` with form for: hotkey binding, model size (tiny/base/small/medium), language, auto-copy toggle, widget visibility toggle, launch-at-startup toggle
    - Use dark theme consistent with widget
    - _Requirements: 8.1, 10.1, 10.4_

  - [x] 11.2 Wire settings changes to main process
    - Hotkey change: unregister old, register new immediately
    - Model change: trigger download if not present locally
    - Launch-at-startup: register/unregister with OS startup programs via `app.setLoginItemSettings`
    - Widget visibility: show/hide floating widget window
    - _Requirements: 8.2, 8.3, 8.4_

- [ ] 12. Checkpoint — Full feature integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement Electron Builder packaging
  - [x] 13.1 Configure electron-builder for cross-platform packaging
    - Add `electron-builder` config to `apps/electron/package.json` or `electron-builder.json`
    - Configure targets: DMG for macOS, NSIS for Windows (with license, directory selection, desktop shortcut), AppImage + deb for Linux
    - Include app icons in `assets/` (ico, icns, png)
    - Add build and package scripts
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 13.2 Add README with CLI installation and usage instructions
    - Document clone, install dependencies, build, and run steps
    - _Requirements: 9.5_

- [ ] 14. Final checkpoint — All features complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from the design document using `fast-check`
- The existing web app at `apps/desktop/` is not modified by any task
