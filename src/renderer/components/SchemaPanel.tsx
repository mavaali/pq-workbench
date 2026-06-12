import type { QueryResult } from '../types/api';

interface Props {
  result: QueryResult | null;
}

export function SchemaPanel({ result }: Props) {
  if (!result) {
    return <p style={{ color: 'var(--colorNeutralForeground3)', fontSize: 13 }}>Run a query to see schema.</p>;
  }

  return (
    <table className="pq-grid" style={{ maxWidth: 500 }}>
      <thead>
        <tr>
          <th>Column</th>
          <th>Type</th>
          <th>Nullable</th>
        </tr>
      </thead>
      <tbody>
        {result.columns.map((col) => (
          <tr key={col.name}>
            <td>{col.name}</td>
            <td>
              <code>{col.type}</code>
            </td>
            <td>{col.nullable ? '✓' : '✗'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
