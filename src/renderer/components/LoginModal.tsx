import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogContent,
  Button,
  Spinner,
  tokens,
  Link,
  makeStyles,
} from '@fluentui/react-components';
import {
  CheckmarkCircle24Filled,
  DismissCircle24Filled,
  Sparkle24Filled,
} from '@fluentui/react-icons';
import type { AuthStatus, LlmAvailability } from '../types/api';

interface Props {
  authStatus: AuthStatus;
  onSignIn: () => void;
  llmAvailability: LlmAvailability | null;
}

const useStyles = makeStyles({
  surface: {
    maxWidth: '720px',
    width: '90vw',
    padding: '0',
    borderRadius: '16px',
    overflow: 'hidden',
  },
  body: {
    padding: '40px 36px 36px',
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  subtitle: {
    fontSize: '13px',
    color: tokens.colorNeutralForeground3,
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  card: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  fabricCard: {
    border: `2px solid ${tokens.colorBrandStroke1}`,
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  cardIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    margin: 0,
  },
  cardDesc: {
    fontSize: '13px',
    color: tokens.colorNeutralForeground3,
    margin: 0,
    lineHeight: '1.4',
  },
  cliRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '13px',
    padding: '6px 0',
  },
  cliName: {
    fontFamily: 'monospace',
    fontWeight: 500,
  },
  statusAvailable: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#0a7c3a',
    fontSize: '12px',
    fontWeight: 500,
  },
  statusMissing: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: tokens.colorNeutralForeground3,
    fontSize: '12px',
  },
  badge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  signingIn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    color: tokens.colorNeutralForeground3,
  },
  connected: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#0a7c3a',
  },
});

export function LoginModal({ authStatus, onSignIn, llmAvailability }: Props) {
  const styles = useStyles();
  const [signingIn, setSigningIn] = useState(false);

  // Auto-dismiss signing-in state when auth succeeds
  useEffect(() => {
    if (authStatus.signedIn) setSigningIn(false);
  }, [authStatus.signedIn]);

  const handleSignIn = () => {
    setSigningIn(true);
    onSignIn();
  };

  const isOpen = !authStatus.signedIn;

  return (
    <Dialog open={isOpen} modalType="alert">
      <DialogSurface className={styles.surface}>
        <DialogBody className={styles.body}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.title}>⚡ PQ Workbench</div>
            <div className={styles.subtitle}>Execute Power Query against Microsoft Fabric</div>
          </div>

          {/* Two-card layout */}
          <DialogContent className={styles.cards}>
            {/* Fabric card */}
            <div className={styles.fabricCard}>
              <div
                className={styles.cardIcon}
                style={{ backgroundColor: tokens.colorBrandBackground }}
              >
                F
              </div>
              <h3 className={styles.cardTitle}>Sign in to Microsoft Fabric</h3>
              <p className={styles.cardDesc}>
                Required to execute queries against your workspaces
              </p>

              <div style={{ flex: 1 }} />

              {/* Sign-in / signing-in / connected states */}
              {!signingIn && !authStatus.signedIn && (
                <Button
                  appearance="primary"
                  size="large"
                  onClick={handleSignIn}
                  style={{ width: '100%' }}
                >
                  Sign In
                </Button>
              )}
              {signingIn && !authStatus.signedIn && (
                <div className={styles.signingIn}>
                  <Spinner size="tiny" />
                  Completing sign-in in your browser…
                </div>
              )}
              {authStatus.signedIn && (
                <div className={styles.connected}>
                  <CheckmarkCircle24Filled style={{ color: '#0a7c3a' }} />
                  {authStatus.userName ?? 'Connected'}
                  <span style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
                    — Connected
                  </span>
                </div>
              )}

              <span
                className={styles.badge}
                style={{
                  color: tokens.colorBrandForeground1,
                  backgroundColor: tokens.colorBrandBackground2,
                }}
              >
                Required
              </span>
            </div>

            {/* AI Assist card */}
            <div className={styles.card}>
              <div
                className={styles.cardIcon}
                style={{ backgroundColor: '#8b5cf6' }}
              >
                <Sparkle24Filled />
              </div>
              <h3 className={styles.cardTitle}>AI Assist</h3>
              <p className={styles.cardDesc}>
                Generate M code from natural language
              </p>

              <div style={{ flex: 1 }} />

              {/* CLI availability rows */}
              <div>
                <div className={styles.cliRow}>
                  <span className={styles.cliName}>GitHub Copilot CLI</span>
                  {llmAvailability === null ? (
                    <Spinner size="extra-tiny" />
                  ) : llmAvailability['gh-copilot'] ? (
                    <span className={styles.statusAvailable}>
                      <CheckmarkCircle24Filled style={{ fontSize: 16 }} />
                      Available
                    </span>
                  ) : (
                    <span className={styles.statusMissing}>
                      <DismissCircle24Filled style={{ fontSize: 16, color: '#c33' }} />
                      <Link
                        href="https://docs.github.com/en/copilot/github-copilot-in-the-cli"
                        target="_blank"
                        style={{ fontSize: 12 }}
                      >
                        Install
                      </Link>
                    </span>
                  )}
                </div>
                <div className={styles.cliRow}>
                  <span className={styles.cliName}>Claude CLI</span>
                  {llmAvailability === null ? (
                    <Spinner size="extra-tiny" />
                  ) : llmAvailability.claude ? (
                    <span className={styles.statusAvailable}>
                      <CheckmarkCircle24Filled style={{ fontSize: 16 }} />
                      Available
                    </span>
                  ) : (
                    <span className={styles.statusMissing}>
                      <DismissCircle24Filled style={{ fontSize: 16, color: '#c33' }} />
                      <Link
                        href="https://docs.anthropic.com/en/docs/claude-cli"
                        target="_blank"
                        style={{ fontSize: 12 }}
                      >
                        Install
                      </Link>
                    </span>
                  )}
                </div>
              </div>

              <Button
                appearance="subtle"
                size="small"
                onClick={() => {
                  const api = (window as any).pqWorkbench;
                  if (api?.auth?.openCliAuth) api.auth.openCliAuth();
                }}
                style={{ alignSelf: 'flex-start' }}
              >
                Set Up GitHub Auth →
              </Button>

              <span
                className={styles.badge}
                style={{
                  color: tokens.colorNeutralForeground3,
                  backgroundColor: tokens.colorNeutralBackground3,
                }}
              >
                Optional
              </span>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
