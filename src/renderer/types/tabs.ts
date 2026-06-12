import type { FabricDataflow, FabricWorkspace, QueryResult } from './api';

export interface EditorTab {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName?: string;
  dataflowId: string;
  dataflowName?: string;
  mCode: string;
  /** Snapshot of mCode at last "clean" point — tab creation, query load, or
   *  successful execute. Used to compute isDirty (mCode !== mCodeBaseline).
   *  When undefined (legacy persisted tabs), the tab is treated as clean. */
  mCodeBaseline?: string;
  activeQueryName?: string;
  activeQueryDoc?: string;
  queryResult: QueryResult | null;
  /** Set when the tab is mid-execute, so the spinner shows per-tab. */
  loading?: boolean;
}

export const DEFAULT_M_CODE =
  `let\n    Source = Table.FromRecords({\n        [ID=1, Name="Hello"],\n        [ID=2, Name="World"]\n    })\nin\n    Source`;

export function makeEmptyTab(seq: number, initial?: Partial<EditorTab>): EditorTab {
  const mCode = initial?.mCode ?? DEFAULT_M_CODE;
  const baseline = initial?.mCodeBaseline ?? mCode;
  return {
    id: `tab-${Date.now()}-${seq}`,
    title: `Untitled ${seq}`,
    workspaceId: '',
    dataflowId: '',
    activeQueryName: undefined,
    activeQueryDoc: undefined,
    queryResult: null,
    loading: false,
    ...initial,
    mCode,
    mCodeBaseline: baseline,
  };
}

/** A tab is dirty when its current mCode diverges from the last "clean" snapshot.
 *  Legacy persisted tabs (no baseline) are treated as clean to avoid a sea of dots. */
export function isTabDirty(t: EditorTab): boolean {
  if (t.mCodeBaseline === undefined) return false;
  return t.mCode !== t.mCodeBaseline;
}

/** Display title: query name if present, else stored title, else fallback. */
export function tabTitle(t: EditorTab): string {
  return t.activeQueryName || t.title || 'Untitled';
}

export function isDataflowAvailable(
  workspaceId: string,
  dataflowId: string,
  dataflows: FabricDataflow[]
): boolean {
  if (!workspaceId || !dataflowId) return false;
  return dataflows.some((d) => d.id === dataflowId);
}

export function isWorkspaceAvailable(
  workspaceId: string,
  workspaces: FabricWorkspace[]
): boolean {
  if (!workspaceId) return false;
  return workspaces.some((w) => w.id === workspaceId);
}

/**
 * Compute backfill patch for legacy/persisted tabs missing workspaceName/dataflowName.
 * Returns an empty object if no backfill is needed (caller can skip update).
 */
export function computeTabNameBackfill(
  tab: EditorTab | undefined | null,
  workspaces: FabricWorkspace[],
  dataflows: FabricDataflow[]
): Partial<EditorTab> {
  if (!tab) return {};
  const patch: Partial<EditorTab> = {};
  if (tab.workspaceId && !tab.workspaceName) {
    const w = workspaces.find((x) => x.id === tab.workspaceId);
    if (w) patch.workspaceName = w.displayName;
  }
  if (tab.dataflowId && !tab.dataflowName) {
    const d = dataflows.find((x) => x.id === tab.dataflowId);
    if (d) patch.dataflowName = d.displayName;
  }
  return patch;
}
