import { useCallback, useEffect, useRef, useState } from 'react';
import { makeEmptyTab, type EditorTab } from '../types/tabs';

const STORAGE_KEY = 'pqwb:tabs:v1';

export const TABS_STORAGE_KEY = STORAGE_KEY;

export interface PersistedState {
  tabs: EditorTab[];
  activeTabId: string;
  seq: number;
}

export function loadPersisted(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persist(state: PersistedState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / serialization — silent */
  }
}

export function useEditorTabs() {
  const seqRef = useRef(1);

  const [tabs, setTabs] = useState<EditorTab[]>(() => {
    const persisted = loadPersisted();
    if (persisted) {
      seqRef.current = persisted.seq;
      return persisted.tabs;
    }
    const first = makeEmptyTab(1);
    seqRef.current = 2;
    return [first];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const persisted = loadPersisted();
    if (persisted) return persisted.activeTabId;
    return ''; // set after mount
  });

  // Ensure activeTabId is valid
  useEffect(() => {
    if (!activeTabId || !tabs.some((t) => t.id === activeTabId)) {
      if (tabs.length > 0) setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  // Persist on change
  useEffect(() => {
    persist({ tabs, activeTabId, seq: seqRef.current });
  }, [tabs, activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const updateTab = useCallback(
    (id: string, patch: Partial<EditorTab>) => {
      setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    []
  );

  const updateActiveTab = useCallback(
    (patch: Partial<EditorTab>) => {
      if (!activeTabId) return;
      updateTab(activeTabId, patch);
    },
    [activeTabId, updateTab]
  );

  const newTab = useCallback(
    (initial?: Partial<EditorTab>) => {
      const n = seqRef.current++;
      const fresh = makeEmptyTab(n, initial);
      setTabs((ts) => [...ts, fresh]);
      setActiveTabId(fresh.id);
      return fresh.id;
    },
    []
  );

  const closeTab = useCallback(
    (id: string) => {
      setTabs((ts) => {
        if (ts.length <= 1) return ts; // never close the last tab
        const idx = ts.findIndex((t) => t.id === id);
        if (idx === -1) return ts;
        const next = ts.filter((t) => t.id !== id);
        if (id === activeTabId) {
          const fallback = next[Math.max(0, idx - 1)] ?? next[0];
          setActiveTabId(fallback.id);
        }
        return next;
      });
    },
    [activeTabId]
  );

  const selectNextTab = useCallback(() => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const next = tabs[(idx + 1) % tabs.length];
    setActiveTabId(next.id);
  }, [tabs, activeTabId]);

  const selectPrevTab = useCallback(() => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
    setActiveTabId(prev.id);
  }, [tabs, activeTabId]);

  return {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    updateTab,
    updateActiveTab,
    newTab,
    closeTab,
    selectNextTab,
    selectPrevTab,
  };
}
