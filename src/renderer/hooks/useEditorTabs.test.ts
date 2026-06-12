import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadPersisted,
  persist,
  TABS_STORAGE_KEY,
  type PersistedState,
} from './useEditorTabs';
import { makeEmptyTab } from '../types/tabs';

describe('useEditorTabs persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns null when nothing is persisted', () => {
    expect(loadPersisted()).toBeNull();
  });

  it('round-trips a persisted state', () => {
    const tab = makeEmptyTab(1);
    const state: PersistedState = { tabs: [tab], activeTabId: tab.id, seq: 2 };

    persist(state);
    const loaded = loadPersisted();

    expect(loaded).not.toBeNull();
    expect(loaded?.activeTabId).toBe(tab.id);
    expect(loaded?.seq).toBe(2);
    expect(loaded?.tabs).toHaveLength(1);
    expect(loaded?.tabs[0].id).toBe(tab.id);
    expect(loaded?.tabs[0].mCode).toBe(tab.mCode);
  });

  it('returns null on corrupt JSON (fallback path)', () => {
    sessionStorage.setItem(TABS_STORAGE_KEY, '{not valid json');
    expect(loadPersisted()).toBeNull();
  });

  it('returns null when tabs array is missing or empty', () => {
    sessionStorage.setItem(
      TABS_STORAGE_KEY,
      JSON.stringify({ tabs: [], activeTabId: '', seq: 1 })
    );
    expect(loadPersisted()).toBeNull();

    sessionStorage.setItem(
      TABS_STORAGE_KEY,
      JSON.stringify({ activeTabId: '', seq: 1 })
    );
    expect(loadPersisted()).toBeNull();
  });

  it('persist is silent on quota / serialization errors', () => {
    const circular: any = { tabs: [], activeTabId: '', seq: 1 };
    circular.self = circular;
    expect(() => persist(circular as PersistedState)).not.toThrow();
  });
});
