import { useMemo, useState } from 'react';
import { Button, Caption1 } from '@fluentui/react-components';
import { ArrowDownload24Regular } from '@fluentui/react-icons';
import type { QueryResult } from '../types/api';
import { queryResultToCsv } from '../utils/csv';

interface Props {
  result: QueryResult | null;
  suggestedName?: string;
}

export function ResultsPanel({ result, suggestedName }: Props) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!result || !sortCol) return result?.rows ?? [];
    return [...result.rows].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortAsc ? av - bv : bv - av;
      }
      const sa = String(av);
      const sb = String(bv);
      return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [result, sortCol, sortAsc]);

  if (!result) {
    return <p style={{ color: '#888', fontSize: 13 }}>Run a query to see results.</p>;
  }

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const handleExport = async () => {
    if (!result) return;
    setExporting(true);
    setExportMsg(null);
    try {
      const csv = queryResultToCsv({ ...result, rows: sorted });
      const api = (window as any).pqWorkbench;
      if (!api?.exportCsv) {
        // Browser dev fallback: download via blob
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${suggestedName || 'query-results'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setExportMsg(`Downloaded ${result.rows.length} rows`);
      } else {
        const r = await api.exportCsv(csv, suggestedName);
        if ('canceled' in r) {
          setExportMsg(null);
        } else {
          setExportMsg(`Saved ${result.rows.length} rows → ${r.path}`);
        }
      }
    } catch (e) {
      setExportMsg(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '4px 0 8px',
          flexShrink: 0,
        }}
      >
        <Caption1>
          {result.rowCount.toLocaleString()} row{result.rowCount === 1 ? '' : 's'}
          {result.rows.length < result.rowCount && ` (showing first ${result.rows.length})`}
          {' · '}
          {result.executionTimeMs}ms
        </Caption1>
        <div style={{ flex: 1 }} />
        {exportMsg && (
          <Caption1 style={{ color: '#666' }}>{exportMsg}</Caption1>
        )}
        <Button
          size="small"
          icon={<ArrowDownload24Regular />}
          onClick={handleExport}
          disabled={exporting || result.rows.length === 0}
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          fontFamily: 'monospace',
        }}
      >
        <thead>
          <tr>
            {result.columns.map((col) => (
              <th
                key={col.name}
                onClick={() => handleSort(col.name)}
                style={{
                  padding: '6px 12px',
                  borderBottom: '2px solid #ddd',
                  textAlign: 'left',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  background: '#f8f8f8',
                }}
              >
                {col.name}
                {sortCol === col.name && (sortAsc ? ' ▲' : ' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              {result.columns.map((col) => (
                <td
                  key={col.name}
                  style={{
                    padding: '4px 12px',
                    whiteSpace: 'nowrap',
                    color: row[col.name] == null ? '#999' : undefined,
                    fontStyle: row[col.name] == null ? 'italic' : undefined,
                  }}
                >
                  {row[col.name] == null ? 'null' : String(row[col.name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
