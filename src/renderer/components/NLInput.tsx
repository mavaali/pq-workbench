import { useState, useEffect, useCallback } from 'react';
import {
  Textarea,
  Button,
  RadioGroup,
  Radio,
  tokens,
} from '@fluentui/react-components';
import {
  SparkleRegular,
} from '@fluentui/react-icons';
import type { LlmProvider, LlmAvailability, LlmProviderStatus } from '../types/api';
import { ProviderStatusIcons } from './ProviderStatusIcons';

interface Props {
  onGenerate: (prompt: string, provider: LlmProvider, context?: string[]) => Promise<void>;
  checkAvailability: () => Promise<LlmAvailability>;
}

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  'gh-copilot': 'GitHub Copilot',
  claude: 'Claude',
};

const EMPTY_STATUS: LlmProviderStatus = { cliInstalled: false, auth: 'unauthenticated' };

export function NLInput({ onGenerate, checkAvailability }: Props) {
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<LlmProvider>('gh-copilot');
  const [availability, setAvailability] = useState<LlmAvailability>({
    'gh-copilot': EMPTY_STATUS,
    claude: EMPTY_STATUS,
  });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    checkAvailability().then(setAvailability);
  }, [checkAvailability]);

  const handleSubmit = useCallback(async () => {
    setGenerating(true);
    try {
      await onGenerate(prompt, provider);
    } finally {
      setGenerating(false);
    }
  }, [prompt, provider, onGenerate]);

  return (
    <div
      style={{
        padding: '8px 16px',
        borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
        background: tokens.colorNeutralBackground2,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
        <SparkleRegular style={{ fontSize: 18, color: tokens.colorBrandForeground1 }} />
        <strong>AI Assist</strong>
        <RadioGroup
          layout="horizontal"
          value={provider}
          onChange={(_, data) => setProvider(data.value as LlmProvider)}
          style={{ marginLeft: 8 }}
        >
          {(Object.keys(PROVIDER_LABELS) as LlmProvider[]).map((p) => (
            <Radio
              key={p}
              value={p}
              label={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {PROVIDER_LABELS[p]}
                  <ProviderStatusIcons
                    status={availability[p]}
                    providerLabel={PROVIDER_LABELS[p]}
                  />
                </span>
              }
            />
          ))}
        </RadioGroup>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Textarea
          placeholder="Describe what you want in natural language…"
          value={prompt}
          onChange={(_, data) => setPrompt(data.value)}
          style={{ flex: 1 }}
          resize="vertical"
          size="small"
        />
        <Button
          appearance="primary"
          icon={<SparkleRegular />}
          disabled={!prompt.trim() || generating}
          onClick={handleSubmit}
        >
          {generating ? 'Generating…' : 'Generate M'}
        </Button>
      </div>
    </div>
  );
}
