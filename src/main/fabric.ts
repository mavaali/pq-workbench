import { getToken } from './auth';

const BASE_URL = 'https://api.fabric.microsoft.com/v1';
const EVALUATE_PATH = '/executeQuery';

export interface FabricWorkspace {
  id: string;
  displayName: string;
  description?: string;
  capacityId?: string;
}

export interface FabricDataflow {
  id: string;
  displayName: string;
  description?: string;
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
}

export interface QueryResult {
  columns: ColumnSchema[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
}

export interface FabricError {
  code: string;
  message: string;
  statusCode?: number;
}

function isFabricError(e: unknown): e is FabricError {
  return typeof e === 'object' && e !== null && 'code' in e && 'message' in e;
}

async function fabricFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    if (res.status === 403 && detail.includes('InsufficientScopes')) {
      throw new Error(
        'Insufficient permissions: The executeQuery API requires Dataflow.Execute.All scope. ' +
        'The Azure CLI token only has user_impersonation. ' +
        'Register a dedicated app with Dataflow.Execute.All permission to enable query execution.'
      );
    }
    throw new Error(`Fabric API ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function listWorkspaces(): Promise<FabricWorkspace[]> {
  const data = await fabricFetch<{ value: FabricWorkspace[] }>('/workspaces');
  return data.value;
}

export async function listDataflows(workspaceId: string): Promise<FabricDataflow[]> {
  const data = await fabricFetch<{ value: FabricDataflow[] }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/items?type=Dataflow`
  );
  return data.value;
}

export async function createDataflow(
  workspaceId: string,
  name: string
): Promise<FabricDataflow> {
  return fabricFetch<FabricDataflow>(
    `/workspaces/${encodeURIComponent(workspaceId)}/dataflows`,
    {
      method: 'POST',
      body: JSON.stringify({ displayName: name }),
    }
  );
}

export async function evaluateQuery(
  workspaceId: string,
  dataflowId: string,
  expression: string,
  topN = 100
): Promise<QueryResult> {
  const start = Date.now();
  const data = await fabricFetch<{ columns: ColumnSchema[]; rows: Record<string, unknown>[] }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/dataflows/${encodeURIComponent(dataflowId)}${EVALUATE_PATH}`,
    {
      method: 'POST',
      body: JSON.stringify({ query: expression }),
    }
  );
  return {
    columns: data.columns,
    rows: data.rows.slice(0, topN),
    rowCount: data.rows.length,
    executionTimeMs: Date.now() - start,
  };
}
