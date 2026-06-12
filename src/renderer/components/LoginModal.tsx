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
  Tooltip,
  makeStyles,
  mergeClasses,
} from '@fluentui/react-components';
import {
  CheckmarkCircle24Filled,
  Sparkle24Filled,
  Copy16Regular,
  ArrowRight16Regular,
} from '@fluentui/react-icons';
import Fabric32Color from '@fabric-msft/svg-icons/Fabric32Color';
import type { AuthStatus, LlmAvailability, LlmProvider } from '../types/api';
import { ProviderStatusIcons } from './ProviderStatusIcons';

interface Props {
  authStatus: AuthStatus;
  onSignIn: () => void;
  llmAvailability: LlmAvailability | null;
}

const TEAL_GRADIENT = 'linear-gradient(90deg, #15B0AB 0%, #0078A6 100%)';
const TITLE_GRADIENT =
  'linear-gradient(135deg, #15B0AB 0%, #0078A6 50%, #6E3FC9 100%)';

const useStyles = makeStyles({
  surface: {
    maxWidth: '520px',
    width: '92vw',
    padding: '0',
    borderRadius: '20px',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
    backgroundImage: `
      radial-gradient(circle at 0% 0%, ${tokens.colorPaletteTealBackground2} 0%, transparent 45%),
      radial-gradient(circle at 100% 100%, ${tokens.colorPaletteLightTealBackground2} 0%, transparent 50%)
    `,
    boxShadow: tokens.shadow64,
    animationName: {
      from: { opacity: 0, transform: 'translateY(8px) scale(0.985)' },
      to: { opacity: 1, transform: 'translateY(0) scale(1)' },
    },
    animationDuration: '280ms',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  body: {
    padding: '48px 44px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: '36px',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    margin: 0,
    lineHeight: 1.15,
  },
  titleAccent: {
    background: TITLE_GRADIENT,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground3,
    marginTop: '4px',
  },
  cards: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  card: {
    position: 'relative',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '14px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow2,
    overflow: 'hidden',
    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '3px',
      background: tokens.colorNeutralStroke2,
    },
  },
  fabricCard: {
    boxShadow: tokens.shadow8,
    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '3px',
      background: TEAL_GRADIENT,
    },
  },
  aiHint: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    fontSize: '13px',
    color: tokens.colorNeutralForeground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '10px',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  aiHintIcon: {
    color: tokens.colorPaletteLightTealForeground2,
    flexShrink: 0,
  },
  aiHintText: {
    flex: 1,
  },
  aiDetails: {
    // Native <details>; we style only the inner panel via aiDetailsContent.
    width: '100%',
  },
  aiSummary: {
    listStyle: 'none',
    cursor: 'pointer',
    color: tokens.colorBrandForegroundLink,
    fontSize: '13px',
    fontWeight: 500,
    '::-webkit-details-marker': { display: 'none' },
    ':hover': { textDecoration: 'underline' },
  },
  aiDetailsContent: {
    marginTop: '12px',
    padding: '16px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '10px',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: 600,
    margin: 0,
    letterSpacing: '-0.01em',
  },
  cardDesc: {
    fontSize: '13px',
    color: tokens.colorNeutralForeground3,
    margin: 0,
    lineHeight: '1.5',
  },
  cliRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '13px',
    padding: '6px 0',
  },
  cliName: {
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: 500,
    fontSize: '12px',
  },
  signInHint: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    padding: '6px 8px',
    marginTop: '4px',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '6px',
  },
  signInCmd: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: '12px',
    flex: 1,
    color: tokens.colorNeutralForeground2,
    userSelect: 'all',
  },
  badge: {
    position: 'absolute',
    top: '14px',
    right: '14px',
    fontSize: '10px',
    fontWeight: 700,
    padding: '3px 9px',
    borderRadius: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
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
    color: tokens.colorPaletteGreenForeground1,
  },
  signInButton: {
    width: '100%',
    height: '40px',
    background: TEAL_GRADIENT,
    border: 'none',
    color: '#fff',
    fontWeight: 600,
    boxShadow: '0 1px 2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.15)',
    transitionProperty: 'transform, box-shadow, filter',
    transitionDuration: '160ms',
    ':hover': {
      filter: 'brightness(1.06)',
      boxShadow: '0 2px 8px rgba(21,176,171,0.35), inset 0 1px 0 rgba(255,255,255,0.18)',
    },
    ':active': {
      transform: 'translateY(1px)',
    },
  },
});

const PROVIDERS: Array<{
  id: LlmProvider;
  name: string;
  installUrl: string;
  signInCmd: string;
}> = [
  {
    id: 'gh-copilot',
    name: 'GitHub Copilot CLI',
    installUrl: 'https://docs.github.com/en/copilot/github-copilot-in-the-cli',
    signInCmd: 'gh auth login --scopes copilot',
  },
  {
    id: 'claude',
    name: 'Claude CLI',
    installUrl: 'https://docs.anthropic.com/en/docs/claude-cli',
    signInCmd: 'claude login',
  },
];

export function LoginModal({ authStatus, onSignIn, llmAvailability }: Props) {
  const styles = useStyles();
  const [signingIn, setSigningIn] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus.signedIn) setSigningIn(false);
  }, [authStatus.signedIn]);

  const handleSignIn = () => {
    setSigningIn(true);
    onSignIn();
  };

  const handleCopy = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd((c) => (c === cmd ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  };

  const isOpen = !authStatus.signedIn;

  return (
    <Dialog open={isOpen} modalType="alert">
      <DialogSurface className={styles.surface}>
        <DialogBody className={styles.body}>
          <div className={styles.header}>
            <Fabric32Color style={{ width: 44, height: 44 }} />
            <h1 className={styles.title}>
              Power Query Workbench
            </h1>
            <div className={styles.subtitle}>
              for <span className={styles.titleAccent}>Microsoft Fabric</span>
            </div>
          </div>

          <DialogContent className={styles.cards}>
            {/* Fabric card — the modal's sole purpose */}
            <div className={mergeClasses(styles.card, styles.fabricCard)}>
              <span
                className={styles.badge}
                style={{
                  color: tokens.colorPaletteTealForeground2,
                  backgroundColor: tokens.colorPaletteTealBackground2,
                }}
              >
                Required
              </span>
              <h3 className={styles.cardTitle}>Sign in to Microsoft Fabric</h3>
              <p className={styles.cardDesc}>
                Required to execute queries against your workspaces and dataflows.
              </p>

              {!signingIn && !authStatus.signedIn && (
                <button
                  className={styles.signInButton}
                  onClick={handleSignIn}
                  autoFocus
                  type="button"
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    Sign in
                    <ArrowRight16Regular />
                  </span>
                </button>
              )}
              {signingIn && !authStatus.signedIn && (
                <div className={styles.signingIn}>
                  <Spinner size="tiny" />
                  Completing sign-in in your browser…
                </div>
              )}
              {authStatus.signedIn && (
                <div className={styles.connected}>
                  <CheckmarkCircle24Filled />
                  {authStatus.userName ?? 'Connected'}
                </div>
              )}
            </div>

            {/* AI Assist — collapsed by default; details discloses provider rows */}
            <div className={styles.aiHint}>
              <Sparkle24Filled className={styles.aiHintIcon} />
              <span className={styles.aiHintText}>
                <strong style={{ fontWeight: 600 }}>AI Assist</strong> is optional — set up anytime via the toolbar toggle.
              </span>
              <details className={styles.aiDetails}>
                <summary className={styles.aiSummary}>Set up now</summary>
                <div className={styles.aiDetailsContent}>
                  {PROVIDERS.map(({ id, name, installUrl, signInCmd }) => {
                    const status = llmAvailability?.[id];
                    const needsSignIn =
                      status?.cliInstalled && status.auth !== 'authenticated';
                    return (
                      <div key={id}>
                        <div className={styles.cliRow}>
                          <span className={styles.cliName}>{name}</span>
                          {!status ? (
                            <Spinner size="extra-tiny" />
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <ProviderStatusIcons
                                status={status}
                                size="small"
                                providerLabel={name}
                                showText
                              />
                              {!status.cliInstalled && (
                                <Link href={installUrl} target="_blank" style={{ fontSize: 12 }}>
                                  Install
                                </Link>
                              )}
                            </span>
                          )}
                        </div>
                        {needsSignIn && (
                          <div className={styles.signInHint}>
                            <span className={styles.signInCmd}>{signInCmd}</span>
                            <Tooltip
                              content={copiedCmd === signInCmd ? 'Copied!' : 'Copy command'}
                              relationship="label"
                            >
                              <Button
                                appearance="subtle"
                                size="small"
                                icon={<Copy16Regular />}
                                aria-label={`Copy sign-in command for ${name}`}
                                onClick={() => handleCopy(signInCmd)}
                              />
                            </Tooltip>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
