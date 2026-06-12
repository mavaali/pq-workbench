import { useState, useCallback, useEffect, useRef } from 'react';
import {
  FluentProvider,
  tokens,
  ToolbarButton,
  ToolbarDivider,
  TabList,
  Tab,
  MessageBar,
  MessageBarActions,
  Link,
  MessageBarTitle,
  MessageBarBody,
  Spinner,
  Switch,
} from '@fluentui/react-components';
import {
  WeatherMoon24Regular,
  WeatherSunny24Regular,
} from '@fluentui/react-icons';
import Fabric28Color from '@fabric-msft/svg-icons/Fabric28Color';
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
import { BindConnectionsModal } from './components/BindConnectionsModal';
import { EditorTabs } from './components/EditorTabs';
import { StatusBar } from './components/StatusBar';
import { useFabric } from './hooks/useFabric';
import { useEditorTabs } from './hooks/useEditorTabs';
import type { LlmAvailability, QueryResult } from './types/api';
import { computeTabNameBackfill, DEFAULT_M_CODE, isTabDirty } from './types/tabs';
import { pqDarkTheme, pqLightTheme } from './theme/fluentTheme';
import { exportQueryResultAsCsv } from './utils/exportCsv';

const DARK_MODE_STORAGE_KEY = 'pqwb:dark-mode';

function loadInitialDark(): boolean {
  try {
    const raw = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch {
    /* fall through */
  }
  // Dark is the product identity (per Fable theme spec); default true.
  return true;
}

const isMacLike = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function App() {
  const [dark, setDarkState] = useState(loadInitialDark);
  const setDark = useCallback((value: boolean) => {
    setDarkState(value);
    try {
      localStorage.setItem(DARK_MODE_STORAGE_KEY, value ? '1' : '0');
    } catch {
      /* ignore storage errors */
    }
  }, []);
  const [resultsTab, setResultsTab] = useState<string>('data');
  const [showNL, setShowNL] = useState(false);
  const [eligibilityDismissed, setEligibilityDismissed] = useState(false);
  const [llmAvailability, setLlmAvailability] = useState<LlmAvailability | null>(null);

  // Connection-binding modal state
  const [bindOpen, setBindOpen] = useState(false);
  const [bindMissing, setBindMissing] = useState<any[]>([]);
  const [bindBound, setBindBound] = useState<any[]>([]);
  const [binding, setBinding] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);
  const [pendingExec, setPendingExec] = useState<{
    workspaceId: string;
    dataflowId: string;
    expression: string;
    queryName?: string;
    originalDocument?: string;
    tabId: string;
  } | null>(null);

  const {
    authStatus,
    workspaces,
    dataflows,
    queries,
    loading,
    error,
    fabricEligibility,
    signIn,
    signOut,
    fetchWorkspaces,
    fetchDataflows,
    fetchQueries,
    createDataflow,
    executeQuery,
    cancelExecute,
    generateMCode,
    checkLlmAvailability,
    setError,
  } = useFabric();

  const {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    updateTab,
    updateActiveTab,
    newTab,
    closeTab,
    selectNextTab,
    selectPrevTab,
  } = useEditorTabs();

  // Hydrate initial tab's workspace/dataflow from legacy localStorage if blank
  useEffect(() => {
    if (activeTab && !activeTab.workspaceId) {
      const ws = localStorage.getItem('pqwb:lastWorkspace') || '';
      const df = localStorage.getItem('pqwb:lastDataflow') || '';
      if (ws) updateActiveTab({ workspaceId: ws, dataflowId: df });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backfill workspaceName/dataflowName when lists load (for legacy/persisted tabs)
  useEffect(() => {
    const patch = computeTabNameBackfill(activeTab, workspaces, dataflows);
    if (Object.keys(patch).length > 0) updateActiveTab(patch);
  }, [workspaces, dataflows, activeTab, updateActiveTab]);

  // Check LLM availability on mount for the login modal
  useEffect(() => {
    checkLlmAvailability().then(setLlmAvailability);
  }, [checkLlmAvailability]);

  // When auth comes online, ensure dataflows/queries for active tab are loaded
  useEffect(() => {
    if (authStatus.signedIn && activeTab?.workspaceId) {
      fetchDataflows(activeTab.workspaceId);
      if (activeTab.dataflowId) {
        fetchQueries(activeTab.workspaceId, activeTab.dataflowId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus.signedIn]);

  // When active tab changes, refetch dataflows + queries to match
  useEffect(() => {
    if (!authStatus.signedIn || !activeTab) return;
    if (activeTab.workspaceId) {
      fetchDataflows(activeTab.workspaceId);
      if (activeTab.dataflowId) {
        fetchQueries(activeTab.workspaceId, activeTab.dataflowId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, activeTab?.workspaceId, activeTab?.dataflowId]);

  // Keyboard shortcuts: Ctrl/Cmd+T (new), Ctrl/Cmd+W (close), Ctrl+Tab / Ctrl+Shift+Tab
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMacLike ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 't') {
        e.preventDefault();
        newTab();
      } else if (k === 'w') {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) selectPrevTab();
        else selectNextTab();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTabId, newTab, closeTab, selectNextTab, selectPrevTab]);

  const handleWorkspaceChange = useCallback(
    (wsId: string) => {
      const wsName = workspaces.find((w) => w.id === wsId)?.displayName;
      updateActiveTab({
        workspaceId: wsId,
        workspaceName: wsName,
        dataflowId: '',
        dataflowName: undefined,
      });
      localStorage.setItem('pqwb:lastWorkspace', wsId);
      localStorage.removeItem('pqwb:lastDataflow');
      if (wsId) fetchDataflows(wsId);
    },
    [fetchDataflows, updateActiveTab, workspaces]
  );

  const handleDataflowChange = useCallback(
    (dfId: string) => {
      const wsId = activeTab?.workspaceId ?? '';
      const dfName = dataflows.find((d) => d.id === dfId)?.displayName;
      updateActiveTab({ dataflowId: dfId, dataflowName: dfName });
      localStorage.setItem('pqwb:lastDataflow', dfId);
      if (dfId && wsId) {
        fetchQueries(wsId, dfId);
      }
    },
    [activeTab?.workspaceId, fetchQueries, updateActiveTab, dataflows]
  );

  // Per-tab in-flight executionId so Cancel can target the right call (#55).
  const executionIdsRef = useRef<Map<string, string>>(new Map());
  const newExecutionId = () =>
    `exec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // Per-tab set of bound connection IDs that produced "Credentials are
  // required to connect to the … source" on a recent executeQuery. Passed
  // to connections.analyze on subsequent Runs so the binding is treated as
  // unusable and the modal re-opens with alternatives (Lakehouse case
  // where multiple authenticated connections of the same type exist but
  // only one matches the query's underlying workspace/lakehouse).
  const failedBindingsRef = useRef<Map<string, Set<string>>>(new Map());

  /** Match the Fabric "Credentials are required to connect to the X source"
   *  error and return the source kind, or null if the error is something else. */
  const extractCredentialsErrorKind = (msg: string): string | null => {
    const m = /Credentials are required to connect to the (\w+) source/i.exec(msg);
    return m ? m[1] : null;
  };

  const runForTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      // Defense in depth: QueryEditor disables the Run affordance when there
      // is no bound dataflow (#44), but we re-check here in case any other
      // path (toolbar shortcut, AI Assist regen, etc.) reaches runForTab.
      if (!tab.workspaceId || !tab.dataflowId) return;

      const api = (window as any).pqWorkbench;
      const tabFailed = failedBindingsRef.current.get(tab.id);
      const excludeIds = tabFailed ? Array.from(tabFailed) : undefined;
      if (api?.connections?.analyze) {
        try {
          const analysis = await api.connections.analyze(
            tab.workspaceId,
            tab.dataflowId,
            tab.activeQueryDoc || tab.mCode,
            excludeIds
          );
          if (!analysis.ready) {
            // Auto-bind path: if EVERY missing source has at least one
            // authenticated candidate, pick the top-ranked authenticated
            // one per source and bind silently — same UX PBI Desktop's
            // Export Query Results provides. Modal still appears when any
            // missing source has zero authenticated candidates or when
            // there's ambiguity (multiple authenticated candidates with
            // the same top rank — defer to user).
            const autoPicks: string[] = [];
            const seenPicks = new Set<string>();
            let canAutoBind = analysis.missing.length > 0;
            for (const m of analysis.missing as Array<{
              candidates: Array<{ id: string; hasCredentials: boolean }>;
            }>) {
              const authd = m.candidates.filter((c) => c.hasCredentials);
              if (authd.length === 0) {
                canAutoBind = false;
                break;
              }
              const top = authd[0];
              if (!seenPicks.has(top.id)) {
                autoPicks.push(top.id);
                seenPicks.add(top.id);
              }
            }
            if (canAutoBind) {
              try {
                await api.connections.bind(tab.workspaceId, tab.dataflowId, autoPicks);
                // Fall through to executeQuery below — analyze is now satisfied.
              } catch (e: unknown) {
                // Auto-bind failed; fall back to the modal so the user can
                // pick / retry / open Fabric manage-connections.
                const msg = e instanceof Error ? e.message : String(e);
                console.warn('[App] auto-bind failed, opening modal:', msg);
                setBindMissing(analysis.missing);
                setBindBound(analysis.bound);
                setBindError(msg);
                setPendingExec({
                  workspaceId: tab.workspaceId,
                  dataflowId: tab.dataflowId,
                  expression: tab.mCode,
                  queryName: tab.activeQueryName,
                  originalDocument: tab.activeQueryDoc,
                  tabId: tab.id,
                });
                setBindOpen(true);
                return;
              }
            } else {
              setBindMissing(analysis.missing);
              setBindBound(analysis.bound);
              setBindError(null);
              setPendingExec({
                workspaceId: tab.workspaceId,
                dataflowId: tab.dataflowId,
                expression: tab.mCode,
                queryName: tab.activeQueryName,
                originalDocument: tab.activeQueryDoc,
                tabId: tab.id,
              });
              setBindOpen(true);
              return;
            }
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn('[App] analyzeForBinding failed, proceeding with execute:', msg);
          setError(`Connection-binding pre-check failed (proceeding with execute anyway): ${msg}`);
        }
      }

      const executionId = newExecutionId();
      executionIdsRef.current.set(tab.id, executionId);
      updateTab(tab.id, { loading: true });
      const result = await executeQuery(
        tab.workspaceId,
        tab.dataflowId,
        tab.mCode,
        undefined,
        tab.activeQueryName,
        tab.activeQueryDoc,
        executionId
      );
      executionIdsRef.current.delete(tab.id);

      // executeQuery returns Error (not null) on failure now. Detect the
      // "Credentials are required to connect to the X source" case — Fabric
      // returns this when a bound+authenticated connection exists but maps
      // to a different lakehouse/warehouse than the query needs (see #79
      // follow-up). Mark the offending binding as failed, re-analyze, and
      // re-open the bind modal so the user can pick another connection of
      // the same kind.
      if (result instanceof Error) {
        const kind = extractCredentialsErrorKind(result.message);
        if (kind && api?.connections?.analyze) {
          updateTab(tab.id, { loading: false });
          try {
            const freshAnalysis = await api.connections.analyze(
              tab.workspaceId,
              tab.dataflowId,
              tab.activeQueryDoc || tab.mCode
            );
            const offending = (freshAnalysis.bound as Array<{ kind: string; datasourceId: string }>)
              .filter((b) => b.kind === kind)
              .map((b) => b.datasourceId);
            if (offending.length) {
              const set = failedBindingsRef.current.get(tab.id) ?? new Set<string>();
              for (const id of offending) set.add(id);
              failedBindingsRef.current.set(tab.id, set);
            }
            // Re-analyze with the failed bindings excluded; this now reports
            // the source kind as missing so we can open the modal.
            const retryAnalysis = await api.connections.analyze(
              tab.workspaceId,
              tab.dataflowId,
              tab.activeQueryDoc || tab.mCode,
              Array.from(failedBindingsRef.current.get(tab.id) ?? [])
            );
            setBindMissing(retryAnalysis.missing);
            setBindBound(retryAnalysis.bound);
            setBindError(
              `${kind} connection bound to this dataflow doesn't have access to the data ` +
              `the query needs. Pick a different ${kind} connection that's authenticated ` +
              `against the right workspace.`
            );
            setPendingExec({
              workspaceId: tab.workspaceId,
              dataflowId: tab.dataflowId,
              expression: tab.mCode,
              queryName: tab.activeQueryName,
              originalDocument: tab.activeQueryDoc,
              tabId: tab.id,
            });
            setBindOpen(true);
            return;
          } catch (e: unknown) {
            console.warn('[App] post-execute analyze for rebind failed:', e);
          }
        }
        return;
      }

      updateTab(tab.id, {
        loading: false,
        queryResult: result ?? tab.queryResult,
        // Successful execute is a clean point — the M now corresponds to the result.
        ...(result ? { mCodeBaseline: tab.mCode } : {}),
      });
    },
    [tabs, executeQuery, updateTab, setError]
  );

  const handleRun = useCallback(() => {
    if (activeTabId) runForTab(activeTabId);
  }, [activeTabId, runForTab]);

  const handleCancelRun = useCallback(() => {
    if (!activeTabId) return;
    const executionId = executionIdsRef.current.get(activeTabId);
    if (!executionId) return;
    cancelExecute(executionId);
    // Optimistically clear the loading spinner; the awaiting executeQuery
    // will resolve with null (error: "Query cancelled") which we suppress.
    executionIdsRef.current.delete(activeTabId);
  }, [activeTabId, cancelExecute]);

  const handleExportCsv = useCallback(
    async (result: QueryResult, suggestedName: string) => {
      const r = await exportQueryResultAsCsv(result, suggestedName);
      if (r.kind === 'error') {
        setError(`Export failed: ${r.message}`);
      }
      // Saved / downloaded / cancelled are silent — no top-of-app toast for the
      // happy path; native Save dialog already gave feedback.
    },
    [setError]
  );

  const handleBindConfirm = useCallback(
    async (connectionIds: string[]) => {
      if (!pendingExec) return;
      const api = (window as any).pqWorkbench;
      setBinding(true);
      setBindError(null);
      try {
        // Clear existing bindings so the previously failed connection is
        // actually replaced. Without clearExisting Fabric would keep both
        // and re-pick the wrong one. Safe because the modal lists picks
        // for ALL sources the query needs.
        await api.connections.bind(
          pendingExec.workspaceId,
          pendingExec.dataflowId,
          connectionIds,
          true
        );
        setBindOpen(false);
        updateTab(pendingExec.tabId, { loading: true });
        const result = await executeQuery(
          pendingExec.workspaceId,
          pendingExec.dataflowId,
          pendingExec.expression,
          undefined,
          pendingExec.queryName,
          pendingExec.originalDocument
        );
        if (result instanceof Error) {
          // The user's manual pick also failed. If it's another credentials
          // error, mark these connection IDs as failed and re-trigger Run
          // so the modal opens again with the remaining alternatives.
          updateTab(pendingExec.tabId, { loading: false });
          const kind = extractCredentialsErrorKind(result.message);
          if (kind) {
            const set = failedBindingsRef.current.get(pendingExec.tabId) ?? new Set<string>();
            for (const id of connectionIds) set.add(id);
            failedBindingsRef.current.set(pendingExec.tabId, set);
            const tabId = pendingExec.tabId;
            setPendingExec(null);
            // Defer to the next tick so the modal close + state settle first.
            setTimeout(() => runForTab(tabId), 0);
            return;
          }
          setPendingExec(null);
          return;
        }
        updateTab(pendingExec.tabId, {
          loading: false,
          queryResult: result ?? null,
          ...(result ? { mCodeBaseline: pendingExec.expression } : {}),
        });
        // User picked successfully — clear the failed-bindings memory for
        // this tab so the next Run starts fresh.
        failedBindingsRef.current.delete(pendingExec.tabId);
        setPendingExec(null);
      } catch (e: unknown) {
        setBindError(e instanceof Error ? e.message : String(e));
      } finally {
        setBinding(false);
      }
    },
    [pendingExec, executeQuery, updateTab, runForTab]
  );

  const handleBindCancel = useCallback(() => {
    setBindOpen(false);
    setPendingExec(null);
    setBindError(null);
  }, []);

  const handleGenerate = useCallback(
    async (prompt: string, provider: 'gh-copilot' | 'claude', context?: string[]) => {
      const result = await generateMCode(provider, prompt, context);
      if (result?.mCode) {
        updateActiveTab({
          mCode: result.mCode,
          activeQueryName: undefined,
          activeQueryDoc: undefined,
        });
      } else {
        setError('AI Assist returned no M code. Check the terminal for details.');
      }
    },
    [generateMCode, setError, updateActiveTab]
  );

  const handleNewTab = useCallback(() => {
    newTab({
      workspaceId: activeTab?.workspaceId ?? '',
      workspaceName: activeTab?.workspaceName,
      dataflowId: '',
    });
  }, [newTab, activeTab?.workspaceId, activeTab?.workspaceName]);

  const tabLoading = !!activeTab?.loading || loading;

  return (
    <FluentProvider theme={dark ? pqDarkTheme : pqLightTheme} style={{ height: '100%' }}>
      <LoginModal
        authStatus={authStatus}
        onSignIn={signIn}
        llmAvailability={llmAvailability}
      />

      <BindConnectionsModal
        open={bindOpen}
        missing={bindMissing}
        bound={bindBound}
        onCancel={handleBindCancel}
        onConfirm={handleBindConfirm}
        binding={binding}
        bindError={bindError}
        workspaceId={pendingExec?.workspaceId || activeTab?.workspaceId}
      />

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Top Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 16px',
            borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
            background: tokens.colorNeutralBackground2,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 4 }}>
            <Fabric28Color style={{ flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>
                Power Query Workbench
              </span>
              <span style={{ fontSize: 11, color: tokens.colorNeutralForeground3 }}>
                for Microsoft Fabric
              </span>
            </div>
          </div>
          <ToolbarDivider />
          <AuthButton
            authStatus={authStatus}
            onSignIn={signIn}
            onSignOut={signOut}
            onAuthSuccess={fetchWorkspaces}
          />
          <ToolbarDivider />
          <WorkspacePicker
            workspaces={workspaces}
            value={activeTab?.workspaceId ?? ''}
            onChange={handleWorkspaceChange}
          />
          <DataflowPicker
            dataflows={dataflows}
            value={activeTab?.dataflowId ?? ''}
            onChange={handleDataflowChange}
            onCreateNew={() =>
              activeTab?.workspaceId && createDataflow(activeTab.workspaceId)
            }
          />
          <div style={{ flex: 1 }} />
          <Switch
            checked={showNL}
            onChange={(_, data) => setShowNL(data.checked)}
            label="AI Assist"
          />
          <ToolbarDivider />
          <ToolbarButton
            icon={dark ? <WeatherSunny24Regular /> : <WeatherMoon24Regular />}
            onClick={() => setDark(!dark)}
            aria-label="Toggle theme"
          />
        </div>

        {/* Fabric eligibility banner */}
        {fabricEligibility &&
          !fabricEligibility.eligible &&
          fabricEligibility.capacityCount >= 0 &&
          !eligibilityDismissed && (
            <MessageBar intent="warning" style={{ flexShrink: 0 }}>
              <MessageBarBody>
                <MessageBarTitle>No Fabric capacity detected.</MessageBarTitle>
                {' '}You're signed in, but none of your workspaces are on a Fabric-eligible
                capacity (F, P, or FT SKU). Executing queries will fail.{' '}
                <Link
                  href="https://learn.microsoft.com/fabric/get-started/fabric-trial"
                  target="_blank"
                  inline
                >
                  Start a free Fabric trial →
                </Link>
              </MessageBarBody>
              <MessageBarActions
                containerAction={
                  <ToolbarButton
                    appearance="subtle"
                    onClick={() => setEligibilityDismissed(true)}
                    aria-label="Dismiss"
                  >
                    Dismiss
                  </ToolbarButton>
                }
              />
            </MessageBar>
          )}

        {error && (
          <MessageBar intent="error" style={{ flexShrink: 0 }}>
            <MessageBarBody>
              <MessageBarTitle>Error</MessageBarTitle>
              {error}
            </MessageBarBody>
          </MessageBar>
        )}

        {showNL && (
          <NLInput
            onGenerate={handleGenerate}
            checkAvailability={checkLlmAvailability}
          />
        )}

        {/* Editor tabs */}
        <EditorTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={setActiveTabId}
          onClose={closeTab}
          onNew={handleNewTab}
        />

        <DangerousFunctionBanner mCode={activeTab?.mCode ?? ''} />

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Allotment vertical defaultSizes={[300, 200]}>
            <Allotment.Pane minSize={150}>
              <Allotment defaultSizes={[200, 600]}>
                <Allotment.Pane
                  minSize={120}
                  preferredSize={200}
                >
                  <QueryBrowser
                    queries={queries}
                    selectedQueryName={activeTab?.activeQueryName}
                    hasDataflow={!!activeTab?.dataflowId}
                    onSelectQuery={(q) => {
                      const wsId = activeTab?.workspaceId ?? '';
                      const dfId = activeTab?.dataflowId ?? '';
                      // 1. If a tab in the same workspace+dataflow already has this query, focus it.
                      const existing = tabs.find(
                        (t) =>
                          t.workspaceId === wsId &&
                          t.dataflowId === dfId &&
                          t.activeQueryName === q.name
                      );
                      if (existing) {
                        setActiveTabId(existing.id);
                        return;
                      }
                      // 2. If the active tab is clean and at default scratch M (or empty),
                      //    replace in place — avoids tab clutter on first browse.
                      const canReplace =
                        activeTab &&
                        !isTabDirty(activeTab) &&
                        !activeTab.activeQueryName &&
                        (activeTab.mCode === DEFAULT_M_CODE || activeTab.mCode.trim() === '');
                      if (canReplace && activeTab) {
                        updateTab(activeTab.id, {
                          workspaceId: wsId,
                          workspaceName: activeTab.workspaceName,
                          dataflowId: dfId,
                          dataflowName: activeTab.dataflowName,
                          mCode: q.expression,
                          mCodeBaseline: q.expression,
                          activeQueryName: q.name,
                          activeQueryDoc: (q as any).originalDocument,
                          queryResult: null,
                        });
                        return;
                      }
                      // 3. Otherwise open a new tab. Protects unsaved scratch M (#43).
                      newTab({
                        workspaceId: wsId,
                        workspaceName: activeTab?.workspaceName,
                        dataflowId: dfId,
                        dataflowName: activeTab?.dataflowName,
                        mCode: q.expression,
                        mCodeBaseline: q.expression,
                        activeQueryName: q.name,
                        activeQueryDoc: (q as any).originalDocument,
                      });
                    }}
                  />
                </Allotment.Pane>
                <Allotment.Pane>
                  <QueryEditor
                    value={activeTab?.mCode ?? ''}
                    onChange={(v) =>
                      updateActiveTab({
                        mCode: v,
                        activeQueryName: undefined,
                        activeQueryDoc: undefined,
                      })
                    }
                    onRun={handleRun}
                    onCancel={handleCancelRun}
                    loading={tabLoading}
                    dark={dark}
                    apiError={error}
                    runDisabledReason={
                      !authStatus.signedIn
                        ? 'Sign in to run'
                        : !activeTab?.workspaceId
                        ? 'Select a workspace and dataflow to run'
                        : !activeTab?.dataflowId
                        ? 'Select a dataflow to run'
                        : null
                    }
                  />
                </Allotment.Pane>
              </Allotment>
            </Allotment.Pane>
            <Allotment.Pane minSize={100}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <TabList
                  selectedValue={resultsTab}
                  onTabSelect={(_, data) => setResultsTab(data.value as string)}
                  size="small"
                  style={{ padding: '0 16px', flexShrink: 0 }}
                >
                  <Tab value="data">Data</Tab>
                  <Tab value="schema">Schema</Tab>
                  <Tab value="info">Query Info</Tab>
                </TabList>
                <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
                  {tabLoading && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        gap: 12,
                      }}
                    >
                      <Spinner size="medium" label="Executing query…" labelPosition="below" />
                    </div>
                  )}
                  {!tabLoading && resultsTab === 'data' && (
                    <ResultsPanel result={activeTab?.queryResult ?? null} />
                  )}
                  {!tabLoading && resultsTab === 'schema' && (
                    <SchemaPanel result={activeTab?.queryResult ?? null} />
                  )}
                  {!tabLoading && resultsTab === 'info' && (
                    <QueryInfoPanel result={activeTab?.queryResult ?? null} />
                  )}
                </div>
              </div>
            </Allotment.Pane>
          </Allotment>
        </div>
        <StatusBar
          connected={authStatus.signedIn}
          identity={authStatus.userName}
          role="unknown"
          lastRun={
            activeTab?.queryResult
              ? {
                  rows: activeTab.queryResult.rowCount,
                  durationMs: activeTab.queryResult.executionTimeMs,
                }
              : undefined
          }
          onExportCsv={
            activeTab?.queryResult
              ? () => handleExportCsv(activeTab.queryResult!, activeTab.activeQueryName || 'query-results')
              : undefined
          }
        />
      </div>
    </FluentProvider>
  );
}
