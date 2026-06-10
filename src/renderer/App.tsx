import { useState, useCallback, useEffect } from 'react';
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  tokens,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  TabList,
  Tab,
  MessageBar,
  MessageBarTitle,
  MessageBarBody,
  Spinner,
  Switch,
} from '@fluentui/react-components';
import {
  WeatherMoon24Regular,
  WeatherSunny24Regular,
} from '@fluentui/react-icons';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { AuthButton } from './components/AuthButton';
import { LoginModal } from './components/LoginModal';
import { WorkspacePicker } from './components/WorkspacePicker';
import { DataflowPicker } from './components/DataflowPicker';
import { QueryEditor } from './components/QueryEditor';
import { NLInput } from './components/NLInput';
import { ResultsPanel } from './components/ResultsPanel';
import { SchemaPanel } from './components/SchemaPanel';
import { QueryInfoPanel } from './components/QueryInfoPanel';
import { DangerousFunctionBanner } from './components/DangerousFunctionBanner';
import { QueryBrowser } from './components/QueryBrowser';
import { useFabric } from './hooks/useFabric';
import type { LlmAvailability } from './types/api';

export function App() {
  const [dark, setDark] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string>('data');
  const [mCode, setMCode] = useState(
    `let\n    Source = Table.FromRecords({\n        [ID=1, Name="Hello"],\n        [ID=2, Name="World"]\n    })\nin\n    Source`
  );
  const [showNL, setShowNL] = useState(false);
  const [llmAvailability, setLlmAvailability] = useState<LlmAvailability | null>(null);

  const fabric = useFabric();
  const {
    authStatus,
    workspaces,
    dataflows,
    queries,
    queryResult,
    loading,
    error,
    signIn,
    signOut,
    fetchWorkspaces,
    fetchDataflows,
    fetchQueries,
    createDataflow,
    executeQuery,
    generateMCode,
    checkLlmAvailability,
    setError,
  } = fabric;

  // Check LLM availability on mount for the login modal
  useEffect(() => {
    checkLlmAvailability().then(setLlmAvailability);
  }, [checkLlmAvailability]);

  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [selectedDataflow, setSelectedDataflow] = useState<string>('');

  const handleWorkspaceChange = useCallback(
    (wsId: string) => {
      setSelectedWorkspace(wsId);
      setSelectedDataflow('');
      if (wsId) fetchDataflows(wsId);
    },
    [fetchDataflows]
  );

  const handleDataflowChange = useCallback(
    (dfId: string) => {
      setSelectedDataflow(dfId);
      if (dfId && selectedWorkspace) {
        fetchQueries(selectedWorkspace, dfId);
      }
    },
    [selectedWorkspace, fetchQueries]
  );

  const handleRun = useCallback(() => {
    if (!selectedWorkspace || !selectedDataflow) {
      setError('Select a workspace and dataflow first');
      return;
    }
    // Basic check: if the editor content doesn't look like M code, warn
    const trimmed = mCode.trim();
    const looksLikeM = /^(let\b|section\b|#|Table\.|List\.|Record\.|Text\.|Number\.|Date\.|Web\.|Sql\.|File\.)/.test(trimmed)
      || trimmed.startsWith('=')
      || trimmed.includes('=>');
    if (!looksLikeM && showNL) {
      setError('This looks like natural language. Use "Generate M" in AI Assist first, then run the generated code.');
      return;
    }
    executeQuery(selectedWorkspace, selectedDataflow, mCode);
  }, [selectedWorkspace, selectedDataflow, mCode, executeQuery, showNL, setError]);

  const handleGenerate = useCallback(
    async (prompt: string, provider: 'gh-copilot' | 'claude', context?: string[]) => {
      const result = await generateMCode(provider, prompt, context);
      console.log('[App] LLM result mCode length:', result?.mCode?.length);
      if (result?.mCode) {
        console.log('[App] Setting mCode:', result.mCode.substring(0, 50));
        setMCode(result.mCode);
        // Force a re-render confirmation
        setTimeout(() => {
          console.log('[App] mCode state after set (via timeout)');
        }, 100);
      } else {
        setError('AI Assist returned no M code. Check the terminal for details.');
      }
    },
    [generateMCode, setError]
  );

  return (
    <FluentProvider theme={dark ? webDarkTheme : webLightTheme} style={{ height: '100%' }}>
      {/* Login modal — blocks interaction until Fabric auth succeeds */}
      <LoginModal
        authStatus={authStatus}
        onSignIn={signIn}
        llmAvailability={llmAvailability}
      />

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Top Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderBottom: `1px solid ${dark ? '#333' : '#e0e0e0'}`,
            background: dark ? '#1a1a1a' : '#fafafa',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 16, marginRight: 12 }}>⚡ PQ Workbench</span>
          <AuthButton
            authStatus={authStatus}
            onSignIn={signIn}
            onSignOut={signOut}
            onAuthSuccess={fetchWorkspaces}
          />
          <ToolbarDivider />
          <WorkspacePicker
            workspaces={workspaces}
            value={selectedWorkspace}
            onChange={handleWorkspaceChange}
          />
          <DataflowPicker
            dataflows={dataflows}
            value={selectedDataflow}
            onChange={handleDataflowChange}
            onCreateNew={() => selectedWorkspace && createDataflow(selectedWorkspace)}
          />
          <div style={{ flex: 1 }} />
          <Switch
            checked={showNL}
            onChange={(_, data) => setShowNL(data.checked)}
            label="AI Assist"
          />
          <ToolbarButton
            icon={dark ? <WeatherSunny24Regular /> : <WeatherMoon24Regular />}
            onClick={() => setDark(!dark)}
            aria-label="Toggle theme"
          />
        </div>

        {/* Error bar */}
        {error && (
          <MessageBar intent="error" style={{ flexShrink: 0 }}>
            <MessageBarBody>
              <MessageBarTitle>Error</MessageBarTitle>
              {error}
            </MessageBarBody>
          </MessageBar>
        )}

        {/* AI Assist input — right below toolbar */}
        {showNL && (
          <NLInput
            onGenerate={handleGenerate}
            checkAvailability={checkLlmAvailability}
          />
        )}

        {/* Dangerous function warning */}
        <DangerousFunctionBanner mCode={mCode} />

        {/* Main content — resizable split between editor and results */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Allotment vertical defaultSizes={[300, 200]}>
            <Allotment.Pane minSize={150}>
              {selectedDataflow ? (
                <Allotment defaultSizes={[200, 600]}>
                  <Allotment.Pane minSize={120} preferredSize={200}>
                    <QueryBrowser
                      queries={queries}
                      onSelectQuery={(q) => setMCode(q.expression)}
                    />
                  </Allotment.Pane>
                  <Allotment.Pane>
                    <QueryEditor
                      value={mCode}
                      onChange={setMCode}
                      onRun={handleRun}
                      loading={loading}
                      dark={dark}
                    />
                  </Allotment.Pane>
                </Allotment>
              ) : (
                <QueryEditor
                  value={mCode}
                  onChange={setMCode}
                  onRun={handleRun}
                  loading={loading}
                  dark={dark}
                />
              )}
            </Allotment.Pane>
            <Allotment.Pane minSize={100}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <TabList
                  selectedValue={selectedTab}
                  onTabSelect={(_, data) => setSelectedTab(data.value as string)}
                  size="small"
                  style={{ padding: '0 16px', flexShrink: 0 }}
                >
                  <Tab value="data">Data</Tab>
                  <Tab value="schema">Schema</Tab>
                  <Tab value="info">Query Info</Tab>
                </TabList>
                <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
                  {loading && <Spinner size="small" label="Executing…" />}
                  {!loading && selectedTab === 'data' && <ResultsPanel result={queryResult} />}
                  {!loading && selectedTab === 'schema' && <SchemaPanel result={queryResult} />}
                  {!loading && selectedTab === 'info' && <QueryInfoPanel result={queryResult} />}
                </div>
              </div>
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
    </FluentProvider>
  );
}
