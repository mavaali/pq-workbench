import { useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { Toolbar, ToolbarButton, Tooltip } from '@fluentui/react-components';
import { PlayRegular } from '@fluentui/react-icons';
import {
  POWERQUERY_LANGUAGE_ID,
  attachAnalysisToModel,
  type AnalysisHandle,
} from '../lsp/powerquery';
import {
  applyExecuteQueryErrorMarker,
  clearExecuteQueryErrorMarkers,
} from '../lsp/apiErrorMarkers';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  loading: boolean;
  dark: boolean;
  /** Error message from the most recent executeQuery call, or null. When set
   *  and a position is parseable, a marker is placed on the editor. */
  apiError?: string | null;
  /** When set, the Run button + Ctrl+Enter are disabled and this string is
   *  shown as a tooltip. Used to gate execution when no dataflow is bound
   *  (issue #44). */
  runDisabledReason?: string | null;
}

export function QueryEditor({
  value,
  onChange,
  onRun,
  loading,
  dark,
  apiError,
  runDisabledReason,
}: Props) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const isSettingValue = useRef(false);
  const analysisHandleRef = useRef<AnalysisHandle | null>(null);
  // Ref so the Monaco keybinding closure sees the latest disabled state
  // without us having to re-register the action on every render.
  const runGuardRef = useRef<{ disabled: boolean; onRun: () => void }>({
    disabled: !!runDisabledReason || loading,
    onRun,
  });
  runGuardRef.current = {
    disabled: !!runDisabledReason || loading,
    onRun,
  };

  // Tear down the per-model Analysis when the component unmounts.
  useEffect(() => {
    return () => {
      analysisHandleRef.current?.dispose();
      analysisHandleRef.current = null;
    };
  }, []);

  // Sync external value changes into Monaco
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== value) {
      isSettingValue.current = true;
      editor.setValue(value);
      isSettingValue.current = false;
    }
  }, [value]);

  // Surface executeQuery errors as markers when a position is parseable.
  // Only re-runs when the apiError changes; user typing clears via onChange below
  // (we don't re-apply on every keystroke because the position would be stale).
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    if (apiError) {
      applyExecuteQueryErrorMarker(monaco, model, apiError);
    } else {
      clearExecuteQueryErrorMarkers(monaco, model);
    }
  }, [apiError]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Set initial value explicitly
    editor.setValue(value);

    // Register M language (basic tokenization). The LSP module adds completion,
    // hover, and diagnostics on top of this.
    monaco.languages.register({ id: POWERQUERY_LANGUAGE_ID });
    monaco.languages.setMonarchTokensProvider(POWERQUERY_LANGUAGE_ID, {
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

    // Ctrl/Cmd+Enter keybinding — gated by runGuardRef so we don't fire a
    // doomed executeQuery when no dataflow is bound (#44).
    editor.addAction({
      id: 'run-query',
      label: 'Run Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        const guard = runGuardRef.current;
        if (guard.disabled) return;
        guard.onRun();
      },
    });

    // Attach Microsoft powerquery-language-services to this model.
    const model = editor.getModel();
    if (model) {
      analysisHandleRef.current?.dispose();
      analysisHandleRef.current = attachAnalysisToModel(monaco, model);
    }
  };

  const runDisabled = !!runDisabledReason || loading;
  const runButton = (
    <ToolbarButton
      icon={<PlayRegular />}
      onClick={onRun}
      disabled={runDisabled}
      appearance="primary"
      aria-label={runDisabledReason ?? 'Run query'}
    >
      Run (Ctrl+Enter)
    </ToolbarButton>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar size="small" style={{ padding: '4px 8px', flexShrink: 0 }}>
        {runDisabledReason ? (
          <Tooltip content={runDisabledReason} relationship="label" withArrow>
            {/* span wrapper so the tooltip still triggers on a disabled button */}
            <span style={{ display: 'inline-flex' }}>{runButton}</span>
          </Tooltip>
        ) : (
          runButton
        )}
      </Toolbar>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          language={POWERQUERY_LANGUAGE_ID}
          theme={dark ? 'vs-dark' : 'light'}
          value={value}
          onChange={(v) => {
            if (!isSettingValue.current) {
              onChange(v ?? '');
              // Clear stale executeQuery marker on user edit — position no
              // longer matches and we don't want a phantom red squiggle.
              const editor = editorRef.current;
              const monaco = monacoRef.current;
              if (editor && monaco) {
                const model = editor.getModel();
                if (model) clearExecuteQueryErrorMarkers(monaco, model);
              }
            }
          }}
          onMount={handleMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            tabSize: 4,
            // Render hover/completion popups in a fixed overflow layer so they
            // can escape the Allotment / flex containers above us. Without this,
            // long signatures get clipped at the editor pane's right/bottom edge.
            fixedOverflowWidgets: true,
          }}
        />
      </div>
    </div>
  );
}
