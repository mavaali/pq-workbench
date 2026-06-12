import { useMemo, useState } from 'react';
import type { QueryResult } from '../types/api';
import { formatCellValue } from '../utils/formatCell';

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
    return <p style={{ color: 'var(--colorNeutralForeground3)', fontSize: 13 }}>Run a query to see results.</p>;
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table className="pq-grid">
        <thead>
          <tr>
            {result.columns.map((col) => (
              <th
                key={col.name}
                onClick={() => handleSort(col.name)}
                style={{
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.name}
                {col.type && (
                  <span className="pq-type-hint">{col.type}</span>
                )}
                {sortCol === col.name && (sortAsc ? ' ▲' : ' ▼')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i}>
              {result.columns.map((col) => {
                const cell = formatCellValue(row[col.name]);
                const dataType =
                  cell.align === 'right' ? 'number' :
                  cell.isNull ? 'null' :
                  'text';
                return (
                  <td
                    key={col.name}
                    data-type={dataType}
                    data-null={cell.isNull ? 'true' : undefined}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {cell.display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
