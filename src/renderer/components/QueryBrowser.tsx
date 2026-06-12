import React from 'react';
import { Text, tokens } from '@fluentui/react-components';
import type { DataflowQuery } from '../types/api';

interface Props {
  queries: DataflowQuery[];
  selectedQueryName?: string;
  /** Whether the active tab has a dataflow bound. Drives empty-state copy
   *  so the rail can render from launch without a layout shift (#52). */
  hasDataflow: boolean;
  onSelectQuery: (query: DataflowQuery) => void;
}

export function QueryBrowser({ queries, selectedQueryName, hasDataflow, onSelectQuery }: Props) {
  if (!hasDataflow) {
    return (
      <div
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <div className="pq-sidebar-heading">Queries</div>
        <Text
          size={200}
          style={{ color: tokens.colorNeutralForeground3, padding: '0 14px' }}
        >
          Select a dataflow to browse its queries.
        </Text>
      </div>
    );
  }

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
        <div className="pq-sidebar-heading">Queries</div>
        <Text
          size={200}
          style={{ color: tokens.colorNeutralForeground3, fontStyle: 'italic', padding: '0 14px' }}
        >
          No queries found. The dataflow may be empty, or you may need Contributor
          access on this workspace.
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
      <div className="pq-sidebar-heading" style={{ flexShrink: 0 }}>Queries</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 8px' }}>
        {queries.map((q) => {
          const isSelected = q.name === selectedQueryName;
          return (
            <div
              key={q.name}
              className="pq-query-item"
              data-selected={isSelected ? 'true' : undefined}
              role="button"
              tabIndex={0}
              aria-current={isSelected ? 'true' : undefined}
              onClick={() => onSelectQuery(q)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectQuery(q);
                }
              }}
            >
              {q.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}
