# Voice to Text — Desktop App

Electron desktop app with always-on-top floating widget and local Whisper transcription. Click the widget or press a global hotkey to record — your transcript is copied to clipboard automatically. Fully offline.

## Quick Start

```bash
npm install
npm run dev
```

## Features

- **Floating widget** — 48×48px always-on-top circle. Click to record, auto-stops on silence.
- **Global hotkey** — `Ctrl+Shift+Space` / `Cmd+Shift+Space` toggles recording from any app.
- **Local Whisper model** — All transcription runs on-device via `@xenova/transformers`.
- **Auto clipboard** — Transcribed text is copied to clipboard instantly.
- **System tray** — Settings, history, and quit from the tray icon.
- **Dark theme** — Polished dark UI across all windows.

## Whisper Models

| Model    | Size     | Speed   | Accuracy |
| -------- | -------- | ------- | -------- |
| tiny.en  | ~75 MB   | Fastest | Lower    |
| base.en  | ~142 MB  | Fast    | Good     |
| small.en | ~466 MB  | Medium  | Better   |
| medium.en| ~1.5 GB  | Slow    | High     |

Models are downloaded during onboarding and stored in your platform's app data directory.

## Build & Package

```bash
npm run build           # Compile TypeScript
npm run package         # Package for your platform
```

Output is written to `dist/`.
