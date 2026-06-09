import type { QueryResult } from '../types/api';

interface Props {
  result: QueryResult | null;
}

export function SchemaPanel({ result }: Props) {
  if (!result) {
    return <p style={{ color: '#888', fontSize: 13 }}>Run a query to see schema.</p>;
  }

  return (
    <table
      style={{
        borderCollapse: 'collapse',
        fontSize: 13,
        width: '100%',
        maxWidth: 500,
      }}
    >
      <thead>
        <tr>
          <th style={thStyle}>Column</th>
          <th style={thStyle}>Type</th>
          <th style={thStyle}>Nullable</th>
        </tr>
      </thead>
      <tbody>
        {result.columns.map((col) => (
          <tr key={col.name} style={{ borderBottom: '1px solid #eee' }}>
            <td style={tdStyle}>{col.name}</td>
            <td style={tdStyle}>
              <code>{col.type}</code>
            </td>
            <td style={tdStyle}>{col.nullable ? '✓' : '✗'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const thStyle: React.CSSProperties = {
  padding: '6px 12px',
  textAlign: 'left',
  borderBottom: '2px solid #ddd',
  background: '#f8f8f8',
};

const tdStyle: React.CSSProperties = {
  padding: '4px 12px',
};
