import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Dropdown,
  Option,
  Spinner,
  Text,
  Caption1,
  Body1,
  Subtitle2,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  PlugConnected24Regular,
  Warning24Filled,
  Open16Regular,
} from '@fluentui/react-icons';

export interface ConnectionCandidate {
  id: string;
  type: string;
  path: string;
  displayName: string | null;
  lastBound: string | null;
  myLastBound: string | null;
  hasCredentials: boolean;
  credentialType: string | null;
}

export interface MissingSourceBinding {
  sourceKind: string;
  acceptableTypes: string[];
  occurrences: number;
  /** Present only when the missing binding is URL-scoped (Web/SharePoint). */
  url?: string;
  candidates: ConnectionCandidate[];
}

interface BoundConnection {
  connectionId: string;
  datasourceId: string;
  kind: string;
  path: string;
}

interface Props {
  open: boolean;
  missing: MissingSourceBinding[];
  bound: BoundConnection[];
  onCancel: () => void;
  /** User confirmed picks. Returns the array of connection IDs to bind (in source order). */
  onConfirm: (selectedConnectionIds: string[]) => void;
  binding: boolean;
  bindError: string | null;
  /** Workspace context for the Fabric manage-connections deep link. */
  workspaceId?: string;
}

const useStyles = makeStyles({
  surface: {
    maxWidth: '720px',
    width: '90vw',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  intro: {
    color: tokens.colorNeutralForeground2,
  },
  source: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    background: tokens.colorNeutralBackground2,
  },
  sourceHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
  },
  badge: {
    fontFamily: tokens.fontFamilyMonospace,
    background: tokens.colorNeutralBackground3,
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
  },
  pathRow: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  candidateMeta: {
    color: tokens.colorNeutralForeground3,
    fontSize: '12px',
  },
  noCandidates: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: '13px',
  },
  alreadyBound: {
    background: tokens.colorNeutralBackground2,
    padding: '10px 14px',
    borderRadius: '6px',
    fontSize: '13px',
  },
});

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function shortPath(p: string): string {
  if (!p) return '(no path)';
  if (p.length <= 80) return p;
  return p.slice(0, 38) + '…' + p.slice(-38);
}

export function BindConnectionsModal({
  open,
  missing,
  bound,
  onCancel,
  onConfirm,
  binding,
  bindError,
  workspaceId,
}: Props) {
  const styles = useStyles();
  // selection state: sourceKind → chosen connection.id
  const [picks, setPicks] = useState<Record<string, string>>({});

  // Initialize picks with the top candidate per missing source whenever the modal opens
  useEffect(() => {
    if (!open) return;
    const initial: Record<string, string> = {};
    for (const m of missing) {
      const pickKey = m.url ? `${m.sourceKind}::${m.url}` : m.sourceKind;
      if (m.candidates.length) initial[pickKey] = m.candidates[0].id;
    }
    setPicks(initial);
  }, [open, missing]);

  const canConfirm = useMemo(() => {
    if (binding) return false;
    return missing.every((m) => {
      const pickKey = m.url ? `${m.sourceKind}::${m.url}` : m.sourceKind;
      return !m.candidates.length || picks[pickKey];
    });
  }, [missing, picks, binding]);

  const hasAnyPick = useMemo(
    () =>
      missing.some((m) => {
        const pickKey = m.url ? `${m.sourceKind}::${m.url}` : m.sourceKind;
        return !!picks[pickKey];
      }),
    [missing, picks]
  );

  const handleConfirm = () => {
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const m of missing) {
      const pickKey = m.url ? `${m.sourceKind}::${m.url}` : m.sourceKind;
      const id = picks[pickKey];
      if (id && !seen.has(id)) {
        ordered.push(id);
        seen.add(id);
      }
    }
    onConfirm(ordered);
  };

  return (
    <Dialog open={open} modalType="modal">
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>
            <span className={styles.header}>
              <PlugConnected24Regular />
              Bind data source connections
            </span>
          </DialogTitle>
          <DialogContent>
            <div className={styles.content}>
              <Body1 className={styles.intro}>
                This query references data sources that aren't bound to the dataflow yet.
                Pick a connection for each — Fabric needs them to run the query under your
                credentials. Already-bound sources are skipped.
              </Body1>

              {bound.length > 0 && (
                <div className={styles.alreadyBound}>
                  <Subtitle2>Already bound</Subtitle2>
                  <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                    {bound.map((b) => (
                      <li key={b.datasourceId}>
                        <span className={styles.badge}>{b.kind || '?'}</span>{' '}
                        <Caption1>
                          {b.path || '(no path)'} · <code>{b.datasourceId.slice(0, 8)}…</code>
                        </Caption1>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {missing.map((m, idx) => {
                // Use URL as part of key/picks-id for URL-scoped sources so multiple
                // URLs of the same sourceKind get independent picks
                const pickKey = m.url ? `${m.sourceKind}::${m.url}` : m.sourceKind;
                const selectedId = picks[pickKey];
                const selected = m.candidates.find((c) => c.id === selectedId);
                return (
                  <div key={`${pickKey}-${idx}`} className={styles.source}>
                    <div className={styles.sourceHeader}>
                      <Subtitle2>{m.sourceKind}</Subtitle2>
                      <Caption1>
                        {m.occurrences} reference{m.occurrences === 1 ? '' : 's'} in mashup ·
                        accepts: {m.acceptableTypes.join(', ')}
                      </Caption1>
                    </div>
                    {m.url && (
                      <div className={styles.pathRow} title={m.url}>
                        URL: {m.url}
                      </div>
                    )}

                    {m.candidates.length === 0 ? (
                      <div className={styles.noCandidates}>
                        <Warning24Filled
                          style={{ verticalAlign: 'middle', marginRight: 6, fontSize: 16 }}
                        />
                        No connections of type{' '}
                        <code>{m.acceptableTypes.join(' / ')}</code> exist in your tenant.
                        Create one in the Fabric portal, then re-run.
                      </div>
                    ) : (
                      <>
                        <Dropdown
                          value={selected ? labelFor(selected) : ''}
                          selectedOptions={selectedId ? [selectedId] : []}
                          onOptionSelect={(_e, data) => {
                            if (data.optionValue)
                              setPicks((p) => ({ ...p, [pickKey]: data.optionValue! }));
                          }}
                          disabled={binding}
                        >
                          {m.candidates.map((c) => (
                            <Option key={c.id} value={c.id} text={labelFor(c)}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <Text weight="semibold">
                                  {!c.hasCredentials && '⚠️ '}
                                  {c.displayName || shortPath(c.path) || '(unnamed connection)'}
                                </Text>
                                <Caption1>
                                  <span className={styles.badge}>{c.type}</span>{' '}
                                  {c.hasCredentials ? (
                                    <>· auth: {c.credentialType || 'configured'}</>
                                  ) : (
                                    <span style={{ color: 'var(--colorPaletteRedForeground1, #b71c1c)' }}>
                                      · no credentials — won't execute
                                    </span>
                                  )}{' '}
                                  · you last used: {formatRelative(c.myLastBound)}
                                  {c.myLastBound !== c.lastBound &&
                                    ` · any-user: ${formatRelative(c.lastBound)}`}{' '}
                                  · <code>{c.id.slice(0, 8)}…</code>
                                </Caption1>
                              </div>
                            </Option>
                          ))}
                        </Dropdown>
                        {selected && (
                          <Caption1 className={styles.candidateMeta}>
                            {m.candidates.length} candidate
                            {m.candidates.length === 1 ? '' : 's'} ·{' '}
                            {m.url ? 'ranked by URL-prefix match, then recency' : 'ranked by recency of your own bindings'}
                          </Caption1>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {bindError && (
                <MessageBar intent="error">
                  <MessageBarBody>{bindError}</MessageBarBody>
                </MessageBar>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="subtle"
              icon={<Open16Regular />}
              onClick={() => {
                const api = (window as any).pqWorkbench;
                // Connections are tenant-level in Fabric, not workspace-scoped.
                // The canonical URL is /connections (no group prefix).
                const url = 'https://app.fabric.microsoft.com/connections';
                api?.openExternal?.(url).catch((e: unknown) => {
                  console.warn('[BindModal] openExternal failed:', e);
                });
              }}
              disabled={binding}
            >
              Manage connections in Fabric
            </Button>
            <div style={{ flex: 1 }} />
            <Button appearance="secondary" onClick={onCancel} disabled={binding}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              icon={binding ? <Spinner size="tiny" /> : <PlugConnected24Regular />}
              onClick={handleConfirm}
              disabled={!canConfirm || !hasAnyPick}
            >
              {binding ? 'Binding…' : 'Bind and run'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function labelFor(c: ConnectionCandidate): string {
  const flag = c.hasCredentials ? '' : '⚠️ ';
  const name = c.displayName || shortPath(c.path) || '(unnamed connection)';
  return `${flag}${name}  ·  ${c.type}`;
}
