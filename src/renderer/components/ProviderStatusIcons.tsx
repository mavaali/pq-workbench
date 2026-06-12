import type { CSSProperties } from 'react';
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
  /** When true, render visible text labels next to each icon
   *  ("Installed · Not authenticated"). Defaults to false to keep
   *  compact tooltip-only callsites (e.g. NLInput radio labels) unchanged. */
  showText?: boolean;
}

function authStateMeta(state: AuthState) {
  switch (state) {
    case 'authenticated':
      return {
        Icon: CheckmarkCircleFilled,
        color: tokens.colorPaletteGreenForeground1,
        label: 'Signed in',
        text: 'Authenticated',
        a11y: 'signed in',
      };
    case 'unauthenticated':
      return {
        Icon: DismissCircleFilled,
        color: tokens.colorPaletteRedForeground1,
        label: 'Not signed in',
        text: 'Not authenticated',
        a11y: 'not signed in',
      };
    case 'unknown':
    default:
      return {
        Icon: QuestionCircleFilled,
        color: tokens.colorNeutralForeground3,
        label: 'Sign-in state unknown',
        text: 'Auth unknown',
        a11y: 'sign-in state unknown',
      };
  }
}

/** Two-icon status: (CLI installed?) + (Authenticated?).
 *  When showText=true, renders visible word labels next to each icon for
 *  callsites where text is preferable to tooltip-only (#49). */
export function ProviderStatusIcons({ status, size = 'small', providerLabel, showText = false }: Props) {
  const dim = size === 'small' ? 14 : 18;
  const dot = size === 'small' ? 8 : 10;

  const cliTooltip = status.cliInstalled ? 'CLI installed' : 'CLI not found on PATH';
  const cliText = status.cliInstalled ? 'Installed' : 'Not installed';
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
        text: 'Install CLI first',
        a11y: 'install the CLI first',
      };
  const AuthIcon = authMeta.Icon;

  const ariaPrefix = providerLabel ? `${providerLabel}: ` : '';
  const ariaLabel = `${ariaPrefix}${cliA11y}, ${authMeta.a11y}`;

  const cliIcon = (
    <Tooltip content={cliTooltip} relationship="description">
      <span style={{ display: 'inline-flex', alignItems: 'center', color: cliColor }}>
        <PlugConnectedRegular style={{ fontSize: dim }} />
      </span>
    </Tooltip>
  );

  const authIcon = (
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
  );

  if (showText) {
    const textStyle: CSSProperties = {
      fontSize: size === 'small' ? 12 : 13,
      color: tokens.colorNeutralForeground2,
      whiteSpace: 'nowrap',
    };
    const sep: CSSProperties = {
      color: tokens.colorNeutralForeground4,
      margin: '0 2px',
    };
    return (
      <span
        role="img"
        aria-label={ariaLabel}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        {cliIcon}
        <span style={textStyle}>{cliText}</span>
        <span style={sep}>·</span>
        {authIcon}
        <span style={textStyle}>{authMeta.text}</span>
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      {cliIcon}
      {authIcon}
    </span>
  );
}
