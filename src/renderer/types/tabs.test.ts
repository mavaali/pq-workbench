import { describe, it, expect } from 'vitest';
import { computeTabNameBackfill, makeEmptyTab, isTabDirty, type EditorTab } from './tabs';
import type { FabricWorkspace, FabricDataflow } from './api';

const ws: FabricWorkspace[] = [
  { id: 'ws-1', displayName: 'Analytics WS' },
  { id: 'ws-2', displayName: 'Finance WS' },
];

const dfs: FabricDataflow[] = [
  { id: 'df-1', displayName: 'Daily ETL' },
  { id: 'df-2', displayName: 'Revenue Roll-up' },
];

describe('computeTabNameBackfill', () => {
  it('returns empty patch when tab is null/undefined', () => {
    expect(computeTabNameBackfill(null, ws, dfs)).toEqual({});
    expect(computeTabNameBackfill(undefined, ws, dfs)).toEqual({});
  });

  it('backfills workspaceName for legacy persisted tab (old shape)', () => {
    const legacy: EditorTab = {
      ...makeEmptyTab(1),
      workspaceId: 'ws-1',
      // workspaceName missing — represents persisted tab written before the field existed
    };

    const patch = computeTabNameBackfill(legacy, ws, dfs);

    expect(patch).toEqual({ workspaceName: 'Analytics WS' });
  });

  it('backfills both workspaceName and dataflowName when both missing', () => {
    const legacy: EditorTab = {
      ...makeEmptyTab(1),
      workspaceId: 'ws-2',
      dataflowId: 'df-2',
    };

    const patch = computeTabNameBackfill(legacy, ws, dfs);

    expect(patch).toEqual({
      workspaceName: 'Finance WS',
      dataflowName: 'Revenue Roll-up',
    });
  });

  it('does not backfill names that are already set', () => {
    const tab: EditorTab = {
      ...makeEmptyTab(1),
      workspaceId: 'ws-1',
      workspaceName: 'Already Set',
      dataflowId: 'df-1',
      dataflowName: 'Also Set',
    };

    expect(computeTabNameBackfill(tab, ws, dfs)).toEqual({});
  });

  it('does not backfill when workspace/dataflow not in current lists', () => {
    const tab: EditorTab = {
      ...makeEmptyTab(1),
      workspaceId: 'ws-unknown',
      dataflowId: 'df-unknown',
    };

    expect(computeTabNameBackfill(tab, ws, dfs)).toEqual({});
  });

  it('returns empty patch when tab has no workspaceId/dataflowId', () => {
    expect(computeTabNameBackfill(makeEmptyTab(1), ws, dfs)).toEqual({});
  });
});

describe('isTabDirty', () => {
  it('is false for a freshly created empty tab (baseline = default M)', () => {
    expect(isTabDirty(makeEmptyTab(1))).toBe(false);
  });

  it('is false for a tab created with custom mCode (baseline matches)', () => {
    const tab = makeEmptyTab(1, { mCode: 'let x = 1 in x' });
    expect(isTabDirty(tab)).toBe(false);
  });

  it('is true when mCode diverges from baseline (user edited)', () => {
    const tab = makeEmptyTab(1, { mCode: 'let x = 1 in x' });
    expect(isTabDirty({ ...tab, mCode: 'let x = 2 in x' })).toBe(true);
  });

  it('is false for legacy persisted tabs with no baseline (avoids sea of dots)', () => {
    const legacy: EditorTab = {
      id: 't1',
      title: 'Old',
      workspaceId: '',
      dataflowId: '',
      mCode: 'anything goes',
      queryResult: null,
      // mCodeBaseline intentionally absent
    };
    expect(isTabDirty(legacy)).toBe(false);
  });

  it('respects explicit mCodeBaseline override in initial', () => {
    const tab = makeEmptyTab(1, { mCode: 'edited', mCodeBaseline: 'original' });
    expect(isTabDirty(tab)).toBe(true);
  });
});
