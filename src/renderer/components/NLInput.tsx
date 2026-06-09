import { useState, useEffect, useCallback } from 'react';
import {
  Textarea,
  Button,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogTrigger,
  RadioGroup,
  Radio,
  Badge,
  Tooltip,
} from '@fluentui/react-components';
import { SparkleRegular, CheckmarkCircleRegular, DismissCircleRegular } from '@fluentui/react-icons';
import type { LlmProvider, LlmAvailability } from '../types/api';

interface Props {
  onGenerate: (prompt: string, provider: LlmProvider, context?: string[]) => Promise<void>;
  checkAvailability: () => Promise<LlmAvailability>;
}

export function NLInput({ onGenerate, checkAvailability }: Props) {
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<LlmProvider>('gh-copilot');
  const [availability, setAvailability] = useState<LlmAvailability>({
    'gh-copilot': false,
    claude: false,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    checkAvailability().then(setAvailability);
  }, [checkAvailability]);

  const handleSubmit = useCallback(async () => {
    setShowPreview(false);
    setGenerating(true);
    try {
      await onGenerate(prompt, provider);
    } finally {
      setGenerating(false);
    }
  }, [prompt, provider, onGenerate]);

  const StatusDot = ({ available }: { available: boolean }) => (
    <Tooltip content={available ? 'Available' : 'Not found'} relationship="label">
      {available ? (
        <CheckmarkCircleRegular style={{ color: '#0a7', fontSize: 16 }} />
      ) : (
        <DismissCircleRegular style={{ color: '#c33', fontSize: 16 }} />
      )}
    </Tooltip>
  );

  return (
    <div
      style={{
        padding: '8px 16px',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <SparkleRegular style={{ fontSize: 18 }} />
        <strong>AI Assist</strong>
        <RadioGroup
          layout="horizontal"
          value={provider}
          onChange={(_, data) => setProvider(data.value as LlmProvider)}
          style={{ marginLeft: 8 }}
        >
          <Radio
            value="gh-copilot"
            label={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                GitHub Copilot <StatusDot available={availability['gh-copilot']} />
              </span>
            }
          />
          <Radio
            value="claude"
            label={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Claude <StatusDot available={availability.claude} />
              </span>
            }
          />
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
        <Dialog open={showPreview} onOpenChange={(_, data) => setShowPreview(data.open)}>
          <DialogTrigger disableButtonEnhancement>
            <Button
              appearance="primary"
              icon={<SparkleRegular />}
              disabled={!prompt.trim() || generating}
              onClick={() => setShowPreview(true)}
            >
              {generating ? 'Generating…' : 'Generate M'}
            </Button>
          </DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Context Preview</DialogTitle>
              <DialogContent>
                <p style={{ marginBottom: 8 }}>
                  The following will be sent to <strong>{provider}</strong>:
                </p>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 13,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 300,
                    overflow: 'auto',
                  }}
                >
                  {`Prompt: ${prompt}\n\nProvider: ${provider}\nContext: (current workspace tables)`}
                </pre>
              </DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary">Cancel</Button>
                </DialogTrigger>
                <Button appearance="primary" onClick={handleSubmit}>
                  Approve &amp; Send
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      </div>
    </div>
  );
}
