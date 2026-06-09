import { useState, useMemo } from 'react';
import { Combobox, Option, Label } from '@fluentui/react-components';
import type { FabricDataflow } from '../types/api';

interface Props {
  dataflows: FabricDataflow[];
  value: string;
  onChange: (id: string) => void;
  onCreateNew: () => void;
}

export function DataflowPicker({ dataflows, value, onChange, onCreateNew }: Props) {
  const [query, setQuery] = useState('');

  const sorted = useMemo(
    () => [...dataflows].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [dataflows]
  );

  const filtered = useMemo(
    () =>
      query
        ? sorted.filter((d) => d.displayName.toLowerCase().includes(query.toLowerCase()))
        : sorted,
    [sorted, query]
  );

  const selectedName = dataflows.find((d) => d.id === value)?.displayName ?? '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Label size="small">Dataflow</Label>
      <Combobox
        placeholder="Search dataflows…"
        size="small"
        value={query || selectedName}
        selectedOptions={value ? [value] : []}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        onOptionSelect={(_, data) => {
          if (data.optionValue === '__create__') {
            onCreateNew();
            setQuery('');
          } else if (data.optionValue) {
            onChange(data.optionValue);
            setQuery('');
          }
        }}
        onBlur={() => setQuery('')}
        style={{ minWidth: 220 }}
        freeform
      >
        <Option key="__create__" value="__create__" text="Create New Scratch">
          ➕ Create New Scratch
        </Option>
        {filtered.map((df) => (
          <Option key={df.id} value={df.id} text={df.displayName}>
            {df.displayName}
          </Option>
        ))}
      </Combobox>
    </div>
  );
}
