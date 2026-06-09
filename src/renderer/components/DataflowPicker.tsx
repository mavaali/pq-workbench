import { Dropdown, Option, Label, Button } from '@fluentui/react-components';
import { AddRegular } from '@fluentui/react-icons';
import type { FabricDataflow } from '../types/api';

interface Props {
  dataflows: FabricDataflow[];
  value: string;
  onChange: (id: string) => void;
  onCreateNew: () => void;
}

export function DataflowPicker({ dataflows, value, onChange, onCreateNew }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Label size="small">Dataflow</Label>
      <Dropdown
        placeholder="Select dataflow…"
        size="small"
        value={dataflows.find((d) => d.id === value)?.displayName ?? ''}
        selectedOptions={value ? [value] : []}
        onOptionSelect={(_, data) => {
          if (data.optionValue === '__create__') {
            onCreateNew();
          } else if (data.optionValue) {
            onChange(data.optionValue);
          }
        }}
        style={{ minWidth: 180 }}
      >
        {dataflows.map((df) => (
          <Option key={df.id} value={df.id}>
            {df.displayName}
          </Option>
        ))}
        <Option key="__create__" value="__create__">
          ➕ Create New Scratch
        </Option>
      </Dropdown>
    </div>
  );
}
