import Store from 'electron-store';
import type { Settings } from '../shared/types';

const defaults: Settings = {
  hotkeyAccelerator: process.platform === 'darwin' ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space',
  hotkeyMode: 'toggle',
  modelName: 'base.en',
  language: 'en',
  autoCopyToClipboard: true,
  showFloatingWidget: true,
  launchAtStartup: false,
  silenceDurationMs: 1500,
  widgetPosition: null,
  onboardingComplete: false,
};

export class SettingsStore {
  private store: Store<Settings>;

  constructor(store?: Store<Settings>) {
    this.store = store ?? new Store<Settings>({ name: 'settings', defaults });
  }

  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.store.get(key);
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.store.set(key, value);
  }

  getAll(): Settings {
    return this.store.store;
  }

  reset(): void {
    this.store.clear();
  }
}
