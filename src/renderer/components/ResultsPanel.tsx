import { useMemo, useState } from 'react';
import type { QueryResult } from '../types/api';

interface Props {
  result: QueryResult | null;
}

export function ResultsPanel({ result }: Props) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

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

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
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
  );
}
