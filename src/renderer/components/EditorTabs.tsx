import { Button, Tooltip, tokens, makeStyles, mergeClasses } from '@fluentui/react-components';
import { Add16Regular, Dismiss12Regular } from '@fluentui/react-icons';
import type { EditorTab } from '../types/tabs';
import { tabTitle } from '../types/tabs';

interface Props {
  tabs: EditorTab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '2px',
    padding: '4px 8px 0 8px',
    background: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
    overflowX: 'auto',
    overflowY: 'hidden',
    minHeight: '42px',
  },
  tab: {
    display: 'inline-flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: '0px',
    padding: '4px 8px 4px 12px',
    minWidth: '140px',
    maxWidth: '240px',
    height: '38px',
    border: `1px solid transparent`,
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    color: tokens.colorNeutralForeground2,
    background: 'transparent',
    transitionProperty: 'background, color, border-color',
    transitionDuration: '120ms',
    userSelect: 'none',
    position: 'relative',
    ':hover': {
      background: tokens.colorNeutralBackground3,
      color: tokens.colorNeutralForeground1,
    },
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    lineHeight: 1.2,
  },
  caption: {
    fontSize: '10px',
    color: tokens.colorNeutralForeground3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
    fontWeight: 400,
    marginTop: '1px',
  },
  active: {
    background: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `1px solid ${tokens.colorNeutralBackground1}`,
    color: tokens.colorNeutralForeground1,
    fontWeight: 600,
    position: 'relative',
    top: '1px',
    ':hover': {
      background: tokens.colorNeutralBackground1,
    },
  },
  root2: {
    minHeight: '42px',
  },
  title: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  close: {
    minWidth: '20px',
    width: '20px',
    height: '20px',
    padding: 0,
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    cursor: 'pointer',
    color: tokens.colorNeutralForeground3,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ':hover': {
      background: tokens.colorNeutralBackground4,
      color: tokens.colorNeutralForeground1,
    },
  },
  newButton: {
    marginLeft: '4px',
    alignSelf: 'center',
  },
});

export function EditorTabs({ tabs, activeTabId, onSelect, onClose, onNew }: Props) {
  const styles = useStyles();

  return (
    <div className={styles.root} role="tablist" aria-label="Open queries">
      {tabs.map((t) => {
        const active = t.id === activeTabId;
        const title = tabTitle(t);
        const caption = t.dataflowName || (t.dataflowId ? '(dataflow)' : 'no dataflow');
        const tooltipParts = [
          t.workspaceName || (t.workspaceId ? '(workspace)' : 'No workspace'),
          t.dataflowName || (t.dataflowId ? '(dataflow)' : 'No dataflow'),
          title,
        ];
        const tooltip = tooltipParts.join(' › ');
        return (
          <div
            key={t.id}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={mergeClasses(styles.tab, active && styles.active)}
            onClick={() => onSelect(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(t.id);
              }
            }}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                onClose(t.id);
              }
            }}
            title={tooltip}
          >
            <div className={styles.titleRow}>
              <span className={styles.title}>{title}</span>
              {tabs.length > 1 && (
                <button
                  className={styles.close}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(t.id);
                  }}
                  aria-label={`Close ${title}`}
                  tabIndex={-1}
                >
                  <Dismiss12Regular />
                </button>
              )}
            </div>
            <div className={styles.caption}>{caption}</div>
          </div>
        );
      })}
      <Tooltip content="New tab (Ctrl/Cmd+T)" relationship="label">
        <Button
          className={styles.newButton}
          appearance="subtle"
          size="small"
          icon={<Add16Regular />}
          onClick={onNew}
          aria-label="New tab"
        />
      </Tooltip>
    </div>
  );
}
