import type { QueryResult } from '../types/api';

interface Props {
  result: QueryResult | null;
}

export function QueryInfoPanel({ result }: Props) {
  if (!result) {
    return <p style={{ color: '#888', fontSize: 13 }}>Run a query to see execution info.</p>;
  }

  return (
    <div style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <InfoRow label="Rows returned" value={result.rowCount.toLocaleString()} />
      <InfoRow label="Execution time" value={`${result.executionTimeMs.toLocaleString()} ms`} />
      <InfoRow label="Columns" value={result.columns.length.toString()} />
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
