import { Tray, Menu, nativeImage, MenuItemConstructorOptions } from 'electron';

export class TrayManager {
  private tray: Tray | null = null;
  private onSettings: (() => void) | null = null;
  private onHistory: (() => void) | null = null;
  private onQuit: (() => void) | null = null;

  create(
    iconPath: string,
    callbacks: { onSettings: () => void; onHistory: () => void; onQuit: () => void },
  ): Tray {
    const icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
    this.tray = new Tray(icon);
    this.tray.setToolTip('Voice to Text');

    this.onSettings = callbacks.onSettings;
    this.onHistory = callbacks.onHistory;
    this.onQuit = callbacks.onQuit;

    this.updateMenu(false);
    return this.tray;
  }

  updateMenu(isRecording: boolean): void {
    if (!this.tray) return;

    const template: MenuItemConstructorOptions[] = [
      {
        label: isRecording ? '⏹ Stop Recording' : '🎙 Start Recording',
        enabled: true,
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => this.onSettings?.(),
      },
      {
        label: 'History',
        click: () => this.onHistory?.(),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => this.onQuit?.(),
      },
    ];

    const contextMenu = Menu.buildFromTemplate(template);
    this.tray.setContextMenu(contextMenu);
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
