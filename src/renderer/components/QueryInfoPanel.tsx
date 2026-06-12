import { useState } from 'react';
import type { QueryResult } from '../types/api';

interface Props {
  result: QueryResult | null;
}

export function QueryInfoPanel({ result }: Props) {
  const [showMeta, setShowMeta] = useState(false);

  if (!result) {
    return <p style={{ color: '#888', fontSize: 13 }}>Run a query to see execution info.</p>;
  }

  return (
    <div style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <InfoRow label="Rows returned" value={result.rowCount.toLocaleString()} />
      <InfoRow label="Execution time" value={`${result.executionTimeMs.toLocaleString()} ms`} />
      <InfoRow label="Columns" value={result.columns.length.toString()} />
      {result.pqArrowMetadata && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            onClick={() => setShowMeta((v) => !v)}
            style={{
              alignSelf: 'flex-start',
              fontSize: 12,
              color: '#666',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {showMeta ? 'Hide' : 'Show'} PQ Arrow metadata
          </button>
          {showMeta && (
            <pre
              style={{
                fontSize: 11,
                background: '#f5f5f5',
                padding: 8,
                borderRadius: 4,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: 300,
                overflow: 'auto',
                margin: 0,
              }}
            >
              {result.pqArrowMetadata}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ fontWeight: 600, minWidth: 140 }}>{label}:</span>
      <span>{value}</span>
    </div>
  );
}
