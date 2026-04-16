# Requirements Document

## Introduction

This document specifies the requirements for a lightweight desktop voice-to-text application built with Electron, inspired by WhisperFlow. The app runs a local Whisper speech-to-text model for offline, private transcription. The primary interface is a small floating icon near the bottom of the screen — click it to start listening, it auto-stops on silence, and the transcribed text is instantly copied to clipboard. No main window is needed for daily use. The existing Next.js web app at `apps/desktop/` remains unchanged. The Electron app lives at `apps/electron/`.

## Glossary

- **Electron_App**: The desktop application shell built with Electron that hosts the UI, manages the system tray, floating widget, and coordinates with the Whisper_Service.
- **Whisper_Service**: A background process managed by the Electron_App that runs the local Whisper speech-to-text model (via whisper.cpp or equivalent native binding) for audio transcription.
- **System_Tray**: The operating system notification area icon and context menu provided by the Electron_App for quick access to controls without opening the main window.
- **Floating_Widget**: A small, always-on-top, frameless overlay window displayed on the desktop that indicates recording status and provides one-click recording toggle.
- **Onboarding_Screen**: The initial setup and instruction screen shown to the user on first launch of the Electron_App.
- **Installer**: The packaged distribution artifact (DMG for macOS, NSIS for Windows, AppImage/deb for Linux) built with electron-builder that provides a professional installation flow.
- **Global_Hotkey**: A system-wide keyboard shortcut registered by the Electron_App that toggles voice recording from any application.
- **Settings_Window**: A preferences window within the Electron_App where the user configures language, hotkey bindings, model selection, and other options.
- **Transcript**: The text output produced by the Whisper_Service from a voice recording.
- **Recording_Session**: The period between the user initiating and stopping a voice capture, during which audio is streamed to the Whisper_Service.
- **Model_Downloader**: A component within the Installer or Onboarding_Screen that downloads the Whisper model files to the local filesystem.

## Requirements

### Requirement 1: Electron Application Shell

**User Story:** As a user, I want a lightweight desktop application that runs in the background with a small floating icon, so that I can use voice-to-text instantly without managing windows.

#### Acceptance Criteria

1. WHEN the user launches the Electron_App for the first time, THE Electron_App SHALL display the Onboarding_Screen for setup, then minimize to the Floating_Widget.
2. WHEN the user launches the Electron_App on subsequent starts, THE Electron_App SHALL skip onboarding and immediately show only the Floating_Widget and System_Tray icon.
3. THE Electron_App SHALL NOT display a main application window by default — the primary interface is the Floating_Widget positioned near the bottom of the screen.
4. WHEN the user closes or minimizes the Electron_App, THE Electron_App SHALL continue running in the background with the System_Tray icon and Floating_Widget visible.
5. THE System_Tray SHALL display a context menu with options for "Settings", "History", and "Quit".
6. WHEN the user selects "Quit" from the System_Tray context menu, THE Electron_App SHALL terminate the Whisper_Service and exit the application completely.

### Requirement 2: Local Whisper Model Transcription

**User Story:** As a user, I want my voice transcribed using a local Whisper model running on my machine, so that my audio data stays private and I can use the app offline.

#### Acceptance Criteria

1. WHEN a Recording_Session ends, THE Whisper_Service SHALL transcribe the captured audio into a Transcript using the locally installed Whisper model.
2. THE Whisper_Service SHALL run as a background process managed by the Electron_App, starting when the Electron_App launches and stopping when the Electron_App quits.
3. WHILE the Whisper_Service is transcribing audio, THE Electron_App SHALL display a "Transcribing…" indicator in both the main window and the Floating_Widget.
4. IF the Whisper model file is missing or corrupted, THEN THE Electron_App SHALL display an error message and prompt the user to re-download the model via the Settings_Window.
5. WHEN the Whisper_Service produces a Transcript, THE Electron_App SHALL make the Transcript available within 5 seconds of the Recording_Session ending for audio segments up to 30 seconds long.

### Requirement 3: Audio Recording and Capture

**User Story:** As a user, I want to simply click the floating icon to start listening and have it auto-stop when I pause speaking, so that the experience is effortless — like talking to someone.

#### Acceptance Criteria

1. WHEN the user clicks the Floating_Widget, THE Electron_App SHALL start a new Recording_Session and capture audio from the default system microphone.
2. WHEN the Electron_App detects 1.5 seconds of silence during an active Recording_Session, THE Electron_App SHALL automatically stop the Recording_Session and send the captured audio to the Whisper_Service.
3. WHEN the user clicks the Floating_Widget during an active Recording_Session, THE Electron_App SHALL manually stop the Recording_Session immediately.
4. IF the system microphone is unavailable or access is denied, THEN THE Floating_Widget SHALL display a brief tooltip instructing the user to grant microphone permissions in system settings.

### Requirement 4: Automatic Clipboard Copy

**User Story:** As a user, I want transcribed text automatically copied to my clipboard, so that I can immediately paste it into any application.

#### Acceptance Criteria

1. WHEN the Whisper_Service produces a Transcript, THE Electron_App SHALL automatically copy the Transcript text to the system clipboard.
2. WHEN the Transcript is copied to the clipboard, THE Electron_App SHALL display a confirmation notification for 2 seconds in the Floating_Widget.
3. WHEN the user clicks on a Transcript entry in the history list, THE Electron_App SHALL copy that Transcript text to the system clipboard.

### Requirement 5: Global Hotkey

**User Story:** As a user, I want a system-wide keyboard shortcut to start and stop recording, so that I can use voice-to-text from any application without switching windows.

#### Acceptance Criteria

1. THE Electron_App SHALL register a Global_Hotkey (default: Ctrl+Shift+Space on Windows/Linux, Cmd+Shift+Space on macOS) that toggles the Recording_Session.
2. WHEN the user presses the Global_Hotkey while no Recording_Session is active, THE Electron_App SHALL start a new Recording_Session.
3. WHEN the user presses the Global_Hotkey while a Recording_Session is active, THE Electron_App SHALL stop the Recording_Session and send the audio to the Whisper_Service.
4. WHEN the Global_Hotkey is pressed, THE Floating_Widget SHALL update its visual state to reflect whether recording has started or stopped.

### Requirement 6: Floating Recording Widget

**User Story:** As a user, I want a small, beautiful floating icon near the bottom of my screen that I can click to instantly start voice-to-text, like WhisperFlow's desktop presence.

#### Acceptance Criteria

1. WHEN the Electron_App is running, THE Floating_Widget SHALL be displayed as a small (48×48px) circular, always-on-top, frameless overlay positioned near the bottom-center of the screen.
2. THE Floating_Widget SHALL be draggable so the user can reposition it anywhere on screen, and SHALL remember its position across restarts.
3. WHILE no Recording_Session is active, THE Floating_Widget SHALL display a microphone icon with a subtle idle animation (gentle pulse).
4. WHILE a Recording_Session is active, THE Floating_Widget SHALL display an animated recording indicator (pulsing ring, color change to indicate listening).
5. WHEN the user clicks the Floating_Widget, THE Electron_App SHALL toggle the Recording_Session (start if idle, auto-stop on silence if recording, or manual stop on second click).
6. WHEN a Transcript is copied to clipboard, THE Floating_Widget SHALL briefly flash a checkmark confirmation for 1.5 seconds.
7. WHEN the user right-clicks the Floating_Widget, THE Floating_Widget SHALL display a context menu with options for "History", "Settings", and "Quit".

### Requirement 7: Onboarding Experience

**User Story:** As a new user, I want a guided first-launch experience that sets up the app, so that I can start using voice-to-text without confusion.

#### Acceptance Criteria

1. WHEN the Electron_App is launched for the first time, THE Onboarding_Screen SHALL display a welcome page explaining the application features.
2. WHEN the user proceeds past the welcome page, THE Onboarding_Screen SHALL request microphone permission from the operating system.
3. WHEN the user proceeds past the microphone permission step, THE Onboarding_Screen SHALL check for the Whisper model and initiate download via the Model_Downloader if the model is not present.
4. WHILE the Model_Downloader is downloading the Whisper model, THE Onboarding_Screen SHALL display a progress bar showing download percentage and estimated time remaining.
5. WHEN the onboarding steps are complete, THE Onboarding_Screen SHALL display a summary of the configured Global_Hotkey and instructions for using the Floating_Widget.
6. WHEN the user completes onboarding, THE Electron_App SHALL persist the onboarding completion state so the Onboarding_Screen is not shown on subsequent launches.

### Requirement 8: Settings and Preferences

**User Story:** As a user, I want to customize the app behavior including hotkey, language, and model, so that the app works the way I prefer.

#### Acceptance Criteria

1. THE Settings_Window SHALL provide options to configure: Global_Hotkey binding, Whisper model size (tiny, base, small, medium), transcription language, auto-copy to clipboard toggle, Floating_Widget visibility toggle, and launch-at-startup toggle.
2. WHEN the user changes the Global_Hotkey in the Settings_Window, THE Electron_App SHALL unregister the previous hotkey and register the new one immediately.
3. WHEN the user selects a different Whisper model size, THE Settings_Window SHALL initiate a download via the Model_Downloader if the selected model is not already present locally.
4. WHEN the user toggles launch-at-startup, THE Electron_App SHALL register or unregister the application with the operating system's startup programs.

### Requirement 9: Professional Installer

**User Story:** As a user, I want a polished installation experience with proper system integration, so that the app feels trustworthy and professional.

#### Acceptance Criteria

1. THE Installer SHALL produce platform-specific packages: DMG for macOS, NSIS installer for Windows, and AppImage plus deb package for Linux.
2. WHEN the user runs the Installer on macOS, THE Installer SHALL present a standard drag-to-Applications installation dialog.
3. WHEN the user runs the Installer on Windows, THE Installer SHALL present a guided installation wizard with license agreement, installation directory selection, and desktop shortcut option.
4. THE Installer SHALL include the Electron_App binary, bundled dependencies, and a README with usage instructions.
5. THE Electron_App SHALL also be installable via command-line using documented steps in the project README (clone, install dependencies, build, run).

### Requirement 10: Dark Theme UI

**User Story:** As a user, I want a visually polished dark-themed interface with smooth animations, so that the app feels modern and flagship-quality.

#### Acceptance Criteria

1. THE Electron_App SHALL use a dark color scheme with background color #0a0a0f and white text, consistent with the existing web application styling.
2. THE Electron_App SHALL use smooth CSS transitions with a minimum duration of 200ms for all interactive state changes (button hover, recording toggle, panel open/close).
3. WHEN a Recording_Session starts, THE Electron_App main window SHALL animate the microphone button from a circle to a pill shape with waveform bars, matching the existing web application behavior.
4. THE Electron_App SHALL use the Inter font family for all text rendering, consistent with the existing web application.

### Requirement 11: Transcript History

**User Story:** As a user, I want to see and access my previous transcriptions, so that I can re-copy text I transcribed earlier.

#### Acceptance Criteria

1. THE Electron_App SHALL persist a history of the 100 most recent Transcript entries to local storage.
2. THE Electron_App main window SHALL display the Transcript history in reverse chronological order with the most recent entry at the top.
3. WHEN the user clicks a Transcript entry in the history list, THE Electron_App SHALL copy that Transcript text to the system clipboard and display a confirmation.
4. THE Electron_App SHALL persist Transcript history across application restarts.

### Requirement 12: Whisper Model Management

**User Story:** As a user, I want the app to handle downloading and managing the Whisper model files, so that I do not need to manually configure the speech recognition engine.

#### Acceptance Criteria

1. WHEN the Model_Downloader initiates a download, THE Model_Downloader SHALL download the Whisper model file from a configured URL to a local application data directory.
2. WHILE the Model_Downloader is downloading, THE Model_Downloader SHALL display download progress including percentage complete and download speed.
3. IF the download is interrupted, THEN THE Model_Downloader SHALL support resuming the download from the last completed byte offset.
4. WHEN the download completes, THE Model_Downloader SHALL verify the integrity of the downloaded model file using a SHA256 checksum.
5. THE Electron_App SHALL store downloaded models in the platform-specific application data directory (e.g., `%APPDATA%` on Windows, `~/Library/Application Support/` on macOS, `~/.local/share/` on Linux).
