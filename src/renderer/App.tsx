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
    queryResult,
    loading,
    error,
    signIn,
    signOut,
    fetchWorkspaces,
    fetchDataflows,
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

  const handleRun = useCallback(() => {
    if (selectedWorkspace && selectedDataflow) {
      executeQuery(selectedWorkspace, selectedDataflow, mCode);
    } else {
      // Run with mock data for demo
      executeQuery('ws-mock', 'df-mock', mCode);
    }
  }, [selectedWorkspace, selectedDataflow, mCode, executeQuery]);

  const handleGenerate = useCallback(
    async (prompt: string, provider: 'gh-copilot' | 'claude', context?: string[]) => {
      const result = await generateMCode(provider, prompt, context);
      if (result) setMCode(result.mCode);
    },
    [generateMCode]
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
            onChange={setSelectedDataflow}
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

        {/* Dangerous function warning */}
        <DangerousFunctionBanner mCode={mCode} />

        {/* Main content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Editor area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <QueryEditor
              value={mCode}
              onChange={setMCode}
              onRun={handleRun}
              loading={loading}
              dark={dark}
            />
            {showNL && (
              <NLInput
                onGenerate={handleGenerate}
                checkAvailability={checkLlmAvailability}
              />
            )}
          </div>
        </div>

        {/* Bottom panel */}
        <div
          style={{
            height: 280,
            borderTop: `1px solid ${dark ? '#333' : '#e0e0e0'}`,
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          <TabList
            selectedValue={selectedTab}
            onTabSelect={(_, data) => setSelectedTab(data.value as string)}
            size="small"
            style={{ padding: '0 16px' }}
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
      </div>
    </FluentProvider>
  );
}
