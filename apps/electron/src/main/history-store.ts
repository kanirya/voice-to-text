import Store from 'electron-store';
import type { TranscriptEntry } from '../shared/types';

const MAX_ENTRIES = 100;

interface HistoryData {
  entries: TranscriptEntry[];
}

export class HistoryStore {
  private store: Store<HistoryData>;

  constructor(store?: Store<HistoryData>) {
    this.store = store ?? new Store<HistoryData>({ name: 'history', defaults: { entries: [] } });
  }

  addEntry(entry: TranscriptEntry): void {
    const entries = this.store.get('entries');
    entries.unshift(entry);
    if (entries.length > MAX_ENTRIES) {
      entries.length = MAX_ENTRIES;
    }
    this.store.set('entries', entries);
  }

  getEntries(): TranscriptEntry[] {
    return this.store.get('entries');
  }

  clearHistory(): void {
    this.store.set('entries', []);
  }
}
