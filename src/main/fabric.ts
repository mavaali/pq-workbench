import { getToken } from './auth';
import { tableFromIPC } from 'apache-arrow';

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
  topN = 100,
  queryName?: string,
  originalDocument?: string
): Promise<QueryResult> {
  const start = Date.now();

  // If we have the original section document and a named query, use it directly
  const effectiveName = queryName || 'pqworkbench_query';
  const effectiveDoc = originalDocument || wrapAsSection(expression, effectiveName);

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
        QueryName: effectiveName,
        customMashupDocument: effectiveDoc,
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

  // Arrow binary response — parse with apache-arrow
  const bytes = await res.arrayBuffer();
  return parseArrowResult(new Uint8Array(bytes), topN, Date.now() - start);
}

// ── Dataflow query browser ──

export interface DataflowQuery {
  name: string;
  expression: string;
  originalDocument?: string;
}

interface DefinitionPart {
  path: string;
  payload: string;
}

interface DefinitionResponse {
  definition: {
    parts: DefinitionPart[];
  };
}

/**
 * Parse an M section document and extract all `shared <name> = <expression>;` blocks.
 */
export function parseSectionDocument(source: string): DataflowQuery[] {
  const queries: DataflowQuery[] = [];
  // Strip the section header line (e.g. "section Section1;")
  const body = source.replace(/^\s*section\s+[^;]*;\s*/i, '');

  // Split on `shared <name> =` boundaries
  const pattern = /\bshared\s+([\w.#]+)\s*=/g;
  const matches: { name: string; start: number; exprStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(body)) !== null) {
    matches.push({ name: m[1], start: m.index, exprStart: m.index + m[0].length });
  }

  for (let i = 0; i < matches.length; i++) {
    const exprStart = matches[i].exprStart;
    const exprEnd = i + 1 < matches.length ? matches[i + 1].start : body.length;
    let expression = body.slice(exprStart, exprEnd).trim();
    // Strip trailing semicolon
    expression = expression.replace(/;\s*$/, '').trim();
    if (expression) {
      queries.push({ name: matches[i].name, expression });
    }
  }

  return queries;
}

export async function getDataflowQueries(
  workspaceId: string,
  dataflowId: string
): Promise<DataflowQuery[]> {
  try {
    const token = await getToken();
    const url = `${BASE_URL}/workspaces/${encodeURIComponent(workspaceId)}/items/${encodeURIComponent(dataflowId)}/getDefinition`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Length': '0',
      },
    });

    if (res.status === 401 || res.status === 403) {
      console.warn('[Fabric] getDefinition returned', res.status, '— user likely lacks contributor access');
      return [];
    }
    if (!res.ok) {
      console.warn('[Fabric] getDefinition failed:', res.status);
      return [];
    }

    const data = (await res.json()) as DefinitionResponse;
    const mashupPart = data.definition?.parts?.find((p) => p.path === 'mashup.pq');
    if (!mashupPart?.payload) return [];

    const decoded = Buffer.from(mashupPart.payload, 'base64').toString('utf-8');
    const queries = parseSectionDocument(decoded);
    // Attach the original document so executeQuery can send it directly
    return queries.map((q) => ({ ...q, originalDocument: decoded }));
  } catch (e) {
    console.error('[Fabric] getDataflowQueries error:', e);
    return [];
  }
}

/** Wrap a raw M expression as a section document if it isn't one already. */
function wrapAsSection(expression: string, queryName: string): string {
  const trimmed = expression.trim();
  // Already a section document
  if (trimmed.toLowerCase().startsWith('section ')) return trimmed;
  // Remove trailing semicolon if present (we'll add our own)
  const clean = trimmed.replace(/;+\s*$/, '');
  const doc = `section Section1; shared ${queryName} = ${clean};`;
  console.log('[Fabric] Mashup document:', doc);
  return doc;
}

function parseArrowResult(
  bytes: Uint8Array,
  topN: number,
  elapsedMs: number
): QueryResult {
  const table = tableFromIPC(bytes);

  const columns: ColumnSchema[] = table.schema.fields.map((f) => ({
    name: f.name,
    type: String(f.type),
    nullable: f.nullable,
  }));

  const rows: Record<string, unknown>[] = [];
  const limit = Math.min(table.numRows, topN);
  for (let i = 0; i < limit; i++) {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      const vec = table.getChild(col.name);
      row[col.name] = vec ? vec.get(i) : null;
    }
    rows.push(row);
  }

  return { columns, rows, rowCount: table.numRows, executionTimeMs: elapsedMs };
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
