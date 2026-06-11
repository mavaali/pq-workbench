import type { QueryResult } from '../types/api';

/**
 * Format a single cell value for CSV. Escapes per RFC 4180:
 * - Fields containing comma, quote, CR, or LF are wrapped in double quotes
 * - Internal quotes are doubled
 * - null/undefined → empty
 * - Date objects → ISO string
 * - Arrays/objects → JSON.stringify
 */
function formatCell(value: unknown): string {
  if (value == null) return '';
  let s: string;
  if (value instanceof Date) {
    s = value.toISOString();
  } else if (typeof value === 'object') {
    try {
      s = JSON.stringify(value);
    } catch {
      s = String(value);
    }
  } else if (typeof value === 'bigint') {
    s = value.toString();
  } else {
    s = String(value);
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialize a QueryResult to RFC 4180 CSV. Uses CRLF line endings for
 * cross-platform compatibility (Excel on Windows expects this).
 */
export function queryResultToCsv(result: QueryResult): string {
  const header = result.columns.map((c) => formatCell(c.name)).join(',');
  const rows = result.rows.map((row) =>
    result.columns.map((c) => formatCell(row[c.name])).join(',')
  );
  return [header, ...rows].join('\r\n') + '\r\n';
}
