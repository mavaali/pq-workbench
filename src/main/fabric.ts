import { mcpClient, McpClient, McpToolResult } from './mcp-client';

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

export async function listWorkspaces(): Promise<FabricWorkspace[]> {
  const result = await mcpClient.callTool('list_workspaces', {});
  return parseWorkspaces(result);
}

export async function listDataflows(workspaceId: string): Promise<FabricDataflow[]> {
  const result = await mcpClient.callTool('list_dataflows', { workspaceId });
  return parseDataflows(result);
}

export async function createDataflow(
  workspaceId: string,
  name: string
): Promise<FabricDataflow> {
  const result = await mcpClient.callTool('create_dataflow', { workspaceId, displayName: name });
  return parseDataflow(result);
}

export async function evaluateQuery(
  workspaceId: string,
  dataflowId: string,
  expression: string,
  topN = 100
): Promise<QueryResult> {
  const start = Date.now();
  const result = await mcpClient.callTool('execute_query', {
    workspaceId,
    dataflowId,
    queryName: 'pqworkbench_query',
    customMashupDocument: expression,
  }, 120_000);
  return parseQueryResult(result, topN, Date.now() - start);
}

// --- Response parsers ---

function parseWorkspaces(result: McpToolResult): FabricWorkspace[] {
  const data = McpClient.parseJson<unknown>(result);
  const items = extractArray(data);
  return items.map((w: Record<string, unknown>) => ({
    id: String(w.id ?? w.Id ?? ''),
    displayName: String(w.displayName ?? w.DisplayName ?? w.name ?? ''),
    description: w.description as string | undefined,
    capacityId: w.capacityId as string | undefined,
  }));
}

function parseDataflows(result: McpToolResult): FabricDataflow[] {
  const data = McpClient.parseJson<unknown>(result);
  const items = extractArray(data);
  return items.map((d: Record<string, unknown>) => ({
    id: String(d.id ?? d.Id ?? ''),
    displayName: String(d.displayName ?? d.DisplayName ?? d.name ?? ''),
    description: d.description as string | undefined,
  }));
}

function parseDataflow(result: McpToolResult): FabricDataflow {
  const data = McpClient.parseJson<Record<string, unknown>>(result);
  return {
    id: String(data.id ?? data.Id ?? ''),
    displayName: String(data.displayName ?? data.DisplayName ?? data.name ?? ''),
    description: data.description as string | undefined,
  };
}

function parseQueryResult(result: McpToolResult, topN: number, elapsedMs: number): QueryResult {
  const text = McpClient.parseText(result);

  // Try parsing as JSON with columns/rows structure
  try {
    const data = JSON.parse(text) as Record<string, unknown>;

    const rawColumns = (data.columns ?? data.Columns ?? data.schema ?? []) as Record<string, unknown>[];
    const rawRows = (data.rows ?? data.Rows ?? data.data ?? data.results ?? []) as Record<string, unknown>[];

    const columns: ColumnSchema[] = Array.isArray(rawColumns)
      ? rawColumns.map((c) => ({
          name: String(c.name ?? c.Name ?? c.columnName ?? ''),
          type: String(c.type ?? c.Type ?? c.dataType ?? 'string'),
          nullable: Boolean(c.nullable ?? c.Nullable ?? true),
        }))
      : [];

    const rows = Array.isArray(rawRows) ? rawRows.slice(0, topN) : [];

    // If columns empty but rows exist, infer columns from first row
    if (columns.length === 0 && rows.length > 0) {
      for (const key of Object.keys(rows[0])) {
        columns.push({ name: key, type: typeof rows[0][key] === 'number' ? 'number' : 'string', nullable: true });
      }
    }

    return {
      columns,
      rows,
      rowCount: Array.isArray(rawRows) ? rawRows.length : rows.length,
      executionTimeMs: elapsedMs,
    };
  } catch { /* not JSON — try as plain text table */ }

  // Fallback: return text as a single-cell result
  return {
    columns: [{ name: 'Result', type: 'string', nullable: false }],
    rows: [{ Result: text }],
    rowCount: 1,
    executionTimeMs: elapsedMs,
  };
}

/** Extract an array from various response shapes. */
function extractArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    // Common wrapper shapes: { value: [...] }, { items: [...] }, { workspaces: [...] }
    for (const key of ['value', 'items', 'workspaces', 'dataflows', 'Value', 'Items']) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
  }
  return [];
}
