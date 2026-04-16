import { clipboard } from 'electron';

export class ClipboardManager {
  copyText(text: string): void {
    clipboard.writeText(text);
  }
}
