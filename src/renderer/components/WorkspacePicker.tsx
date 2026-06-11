import { useState, useMemo } from 'react';
import { Combobox, Option } from '@fluentui/react-components';
import GroupWorkspace24NonItem from '@fabric-msft/svg-icons/GroupWorkspace24NonItem';
import type { FabricWorkspace } from '../types/api';

interface Props {
  workspaces: FabricWorkspace[];
  value: string;
  onChange: (id: string) => void;
}

export function WorkspacePicker({ workspaces, value, onChange }: Props) {
  const [query, setQuery] = useState('');

  const sorted = useMemo(
    () => [...workspaces].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [workspaces]
  );

  const filtered = useMemo(
    () =>
      query
        ? sorted.filter((w) => w.displayName.toLowerCase().includes(query.toLowerCase()))
        : sorted,
    [sorted, query]
  );

  const selectedName = workspaces.find((w) => w.id === value)?.displayName ?? '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <GroupWorkspace24NonItem
        style={{ width: 18, height: 18, flexShrink: 0 }}
        aria-label="Workspace"
      />
      <Combobox
        placeholder="Workspace…"
        size="small"
        value={query || selectedName}
        selectedOptions={value ? [value] : []}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        onOptionSelect={(_, data) => {
          if (data.optionValue) {
            onChange(data.optionValue);
            setQuery('');
          }
        }}
        onBlur={() => setQuery('')}
        style={{ minWidth: 200 }}
        freeform
        aria-label="Workspace"
      >
        {filtered.map((ws) => (
          <Option key={ws.id} value={ws.id} text={ws.displayName}>
            {ws.displayName}
          </Option>
        ))}
        {filtered.length === 0 && (
          <Option key="no-match" value="" disabled text="No matches">
            No matching workspaces
          </Option>
        )}
      </Combobox>
    </div>
  );
}
