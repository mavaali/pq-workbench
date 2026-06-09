import { Dropdown, Option, Label } from '@fluentui/react-components';
import type { FabricWorkspace } from '../types/api';

interface Props {
  workspaces: FabricWorkspace[];
  value: string;
  onChange: (id: string) => void;
}

export function WorkspacePicker({ workspaces, value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Label size="small">Workspace</Label>
      <Dropdown
        placeholder="Select workspace…"
        size="small"
        value={workspaces.find((w) => w.id === value)?.displayName ?? ''}
        selectedOptions={value ? [value] : []}
        onOptionSelect={(_, data) => {
          if (data.optionValue) onChange(data.optionValue);
        }}
        style={{ minWidth: 180 }}
      >
        {workspaces.map((ws) => (
          <Option key={ws.id} value={ws.id}>
            {ws.displayName}
          </Option>
        ))}
      </Dropdown>
    </div>
  );
}
