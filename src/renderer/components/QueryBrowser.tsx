import React from 'react';
import {
  Button,
  Text,
  tokens,
} from '@fluentui/react-components';
import { Code24Regular } from '@fluentui/react-icons';
import type { DataflowQuery } from '../types/api';

interface Props {
  queries: DataflowQuery[];
  selectedQueryName?: string;
  onSelectQuery: (query: DataflowQuery) => void;
}

export function QueryBrowser({ queries, selectedQueryName, onSelectQuery }: Props) {
  if (queries.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <Text
          weight="semibold"
          size={300}
          style={{ marginBottom: 8 }}
        >
          Queries
        </Text>
        <Text
          size={200}
          style={{ color: tokens.colorNeutralForeground3, fontStyle: 'italic' }}
        >
          (no queries — need contributor access)
        </Text>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Text
        weight="semibold"
        size={300}
        style={{ padding: '12px 16px 8px', flexShrink: 0 }}
      >
        Queries
      </Text>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {queries.map((q) => {
          const isSelected = q.name === selectedQueryName;
          return (
            <Button
              key={q.name}
              appearance={isSelected ? 'primary' : 'subtle'}
              icon={<Code24Regular />}
              onClick={() => onSelectQuery(q)}
              aria-current={isSelected ? 'true' : undefined}
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                textAlign: 'left',
                minHeight: 32,
              }}
            >
              {q.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
