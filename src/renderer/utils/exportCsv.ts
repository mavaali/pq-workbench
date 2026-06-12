import type { QueryResult } from '../types/api';
import { queryResultToCsv } from './csv';

/** Generic CSV export driven by the native Save dialog (Electron) with a
 *  browser-blob fallback for dev (npm start without main). Used by both the
 *  status bar action and any future per-tab export affordance. */
export async function exportQueryResultAsCsv(
  result: QueryResult,
  suggestedName: string | undefined
): Promise<
  | { kind: 'saved'; path: string; rows: number }
  | { kind: 'downloaded'; rows: number }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }
> {
  try {
    const csv = queryResultToCsv(result);
    const api = (window as unknown as { pqWorkbench?: { exportCsv?: (csv: string, name?: string) => Promise<{ path: string } | { canceled: true }> } }).pqWorkbench;
    if (!api?.exportCsv) {
      // Browser dev fallback
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${suggestedName || 'query-results'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return { kind: 'downloaded', rows: result.rows.length };
    }
    const r = await api.exportCsv(csv, suggestedName);
    if ('canceled' in r) return { kind: 'cancelled' };
    return { kind: 'saved', path: r.path, rows: result.rows.length };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
