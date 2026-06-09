import { Button, Avatar, Tooltip } from '@fluentui/react-components';
import { PersonRegular, SignOutRegular } from '@fluentui/react-icons';
import type { AuthStatus } from '../types/api';
import { useEffect } from 'react';

interface Props {
  authStatus: AuthStatus;
  onSignIn: () => void;
  onSignOut: () => void;
  onAuthSuccess: () => void;
}

export function AuthButton({ authStatus, onSignIn, onSignOut, onAuthSuccess }: Props) {
  useEffect(() => {
    if (authStatus.signedIn) {
      onAuthSuccess();
    }
  }, [authStatus.signedIn, onAuthSuccess]);

  if (!authStatus.signedIn) {
    return (
      <Button
        appearance="primary"
        icon={<PersonRegular />}
        onClick={onSignIn}
        size="small"
      >
        Sign In
      </Button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Tooltip content={`Tenant: ${authStatus.tenantId ?? 'unknown'}`} relationship="label">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar name={authStatus.userName} size={24} />
          <span style={{ fontSize: 13 }}>{authStatus.userName}</span>
        </div>
      </Tooltip>
      <Button
        appearance="subtle"
        icon={<SignOutRegular />}
        onClick={onSignOut}
        size="small"
        aria-label="Sign out"
      />
    </div>
  );
}
