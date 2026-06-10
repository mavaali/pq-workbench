import { useRef, useCallback, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Button, Toolbar, ToolbarButton } from '@fluentui/react-components';
import { PlayRegular } from '@fluentui/react-icons';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  loading: boolean;
  dark: boolean;
}

export function QueryEditor({ value, onChange, onRun, loading, dark }: Props) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  // Sync external value changes into Monaco
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== value) {
      editor.setValue(value);
    }
  }, [value]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Register M language (basic tokenization)
    monaco.languages.register({ id: 'powerquery' });
    monaco.languages.setMonarchTokensProvider('powerquery', {
      keywords: [
        'let', 'in', 'if', 'then', 'else', 'true', 'false', 'null',
        'and', 'or', 'not', 'each', 'type', 'as', 'is', 'error',
        'try', 'otherwise', 'meta', 'section', 'shared',
      ],
      tokenizer: {
        root: [
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],
          [/"[^"]*"/, 'string'],
          [/#"[^"]*"/, 'string'],
          [/\b\d+(\.\d+)?\b/, 'number'],
          [
            /[a-zA-Z_]\w*/,
            {
              cases: {
                '@keywords': 'keyword',
                '@default': 'identifier',
              },
            },
          ],
          [/[{}()\[\]]/, '@brackets'],
          [/[=><!+\-*/&|,;.]/, 'delimiter'],
        ],
        comment: [
          [/\*\//, 'comment', '@pop'],
          [/./, 'comment'],
        ],
      },
    });

    // Ctrl/Cmd+Enter keybinding
    editor.addAction({
      id: 'run-query',
      label: 'Run Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => onRun(),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Toolbar size="small" style={{ padding: '4px 8px', flexShrink: 0 }}>
        <ToolbarButton
          icon={<PlayRegular />}
          onClick={onRun}
          disabled={loading}
          appearance="primary"
        >
          Run (Ctrl+Enter)
        </ToolbarButton>
      </Toolbar>
      <div style={{ flex: 1 }}>
        <Editor
          height="100%"
          language="powerquery"
          theme={dark ? 'vs-dark' : 'light'}
          value={value}
          onChange={(v) => onChange(v ?? '')}
          onMount={handleMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            tabSize: 4,
          }}
        />
      </div>
    </div>
  );
}
