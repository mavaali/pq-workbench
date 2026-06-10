import { getToken } from './auth';

const BASE_URL = 'https://api.fabric.microsoft.com/v1';

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

  const token = await getToken();
  const res = await fetch(
    `${BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/dataflows/${encodeURIComponent(dataflowId)}/executeQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queryName: 'pqworkbench_query',
        customMashupDocument: expression,
      }),
    }
  );

  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { body = await res.text(); }
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`Execute query failed (${res.status}): ${detail}`);
  }

  // Response may be Arrow binary or JSON — handle both
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('json')) {
    const data = await res.json() as Record<string, unknown>;
    return parseJsonResult(data, topN, Date.now() - start);
  }

  // Binary (Arrow) response — return raw indicator for now
  const bytes = await res.arrayBuffer();
  return {
    columns: [{ name: 'Result', type: 'binary', nullable: false }],
    rows: [{ Result: `(${bytes.byteLength} bytes Arrow data)` }],
    rowCount: 1,
    executionTimeMs: Date.now() - start,
  };
}

function parseJsonResult(
  data: Record<string, unknown>,
  topN: number,
  elapsedMs: number
): QueryResult {
  const rawColumns = (data.columns ?? data.schema ?? []) as Record<string, unknown>[];
  const rawRows = (data.rows ?? data.data ?? data.results ?? []) as Record<string, unknown>[];

  let columns: ColumnSchema[] = Array.isArray(rawColumns)
    ? rawColumns.map((c) => ({
        name: String(c.name ?? c.columnName ?? ''),
        type: String(c.type ?? c.dataType ?? 'string'),
        nullable: Boolean(c.nullable ?? true),
      }))
    : [];

  const rows = Array.isArray(rawRows) ? rawRows.slice(0, topN) : [];

  if (columns.length === 0 && rows.length > 0) {
    columns = Object.keys(rows[0]).map((key) => ({
      name: key,
      type: typeof rows[0][key] === 'number' ? 'number' : 'string',
      nullable: true,
    }));
  }

  return { columns, rows, rowCount: rawRows.length, executionTimeMs: elapsedMs };
}
