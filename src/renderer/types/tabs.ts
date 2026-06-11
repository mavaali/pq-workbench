import type { FabricDataflow, FabricWorkspace, QueryResult } from './api';

export interface EditorTab {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName?: string;
  dataflowId: string;
  dataflowName?: string;
  mCode: string;
  activeQueryName?: string;
  activeQueryDoc?: string;
  queryResult: QueryResult | null;
  /** Set when the tab is mid-execute, so the spinner shows per-tab. */
  loading?: boolean;
}

export const DEFAULT_M_CODE =
  `let\n    Source = Table.FromRecords({\n        [ID=1, Name="Hello"],\n        [ID=2, Name="World"]\n    })\nin\n    Source`;

export function makeEmptyTab(seq: number, initial?: Partial<EditorTab>): EditorTab {
  return {
    id: `tab-${Date.now()}-${seq}`,
    title: `Untitled ${seq}`,
    workspaceId: '',
    dataflowId: '',
    mCode: DEFAULT_M_CODE,
    activeQueryName: undefined,
    activeQueryDoc: undefined,
    queryResult: null,
    loading: false,
    ...initial,
  };
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
