import { describe, it, expect } from 'vitest';
import { computeTabNameBackfill, makeEmptyTab, type EditorTab } from './tabs';
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
