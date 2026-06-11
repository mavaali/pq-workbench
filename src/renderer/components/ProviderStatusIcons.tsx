import { Tooltip, tokens } from '@fluentui/react-components';
import {
  CheckmarkCircleFilled,
  DismissCircleFilled,
  QuestionCircleFilled,
  PlugConnectedRegular,
  PersonRegular,
} from '@fluentui/react-icons';
import type { AuthState, LlmProviderStatus } from '../types/api';

interface Props {
  status: LlmProviderStatus;
  size?: 'small' | 'medium';
  providerLabel?: string;
}

function authStateMeta(state: AuthState) {
  switch (state) {
    case 'authenticated':
      return {
        Icon: CheckmarkCircleFilled,
        color: tokens.colorPaletteGreenForeground1,
        label: 'Signed in',
        a11y: 'signed in',
      };
    case 'unauthenticated':
      return {
        Icon: DismissCircleFilled,
        color: tokens.colorPaletteRedForeground1,
        label: 'Not signed in',
        a11y: 'not signed in',
      };
    case 'unknown':
    default:
      return {
        Icon: QuestionCircleFilled,
        color: tokens.colorNeutralForeground3,
        label: 'Sign-in state unknown',
        a11y: 'sign-in state unknown',
      };
  }
}

/** Two-icon status: (CLI installed?) + (Authenticated?). */
export function ProviderStatusIcons({ status, size = 'small', providerLabel }: Props) {
  const dim = size === 'small' ? 14 : 18;
  const dot = size === 'small' ? 8 : 10;

  const cliTooltip = status.cliInstalled ? 'CLI installed' : 'CLI not found on PATH';
  const cliColor = status.cliInstalled
    ? tokens.colorPaletteGreenForeground1
    : tokens.colorPaletteRedForeground1;
  const cliA11y = status.cliInstalled ? 'CLI installed' : 'CLI missing';

  const authMeta = status.cliInstalled
    ? authStateMeta(status.auth)
    : {
        Icon: DismissCircleFilled,
        color: tokens.colorPaletteRedForeground1,
        label: 'Install the CLI first',
        a11y: 'install the CLI first',
      };
  const AuthIcon = authMeta.Icon;

  const ariaPrefix = providerLabel ? `${providerLabel}: ` : '';
  const ariaLabel = `${ariaPrefix}${cliA11y}, ${authMeta.a11y}`;

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <Tooltip content={cliTooltip} relationship="description">
        <span style={{ display: 'inline-flex', alignItems: 'center', color: cliColor }}>
          <PlugConnectedRegular style={{ fontSize: dim }} />
        </span>
      </Tooltip>
      <Tooltip content={authMeta.label} relationship="description">
        <span
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            color: authMeta.color,
          }}
        >
          <PersonRegular style={{ fontSize: dim }} />
          <AuthIcon
            style={{
              fontSize: dot,
              position: 'absolute',
              right: -3,
              bottom: -2,
              background: tokens.colorNeutralBackground1,
              borderRadius: '50%',
            }}
          />
        </span>
      </Tooltip>
    </span>
  );
}
