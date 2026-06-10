import { useState, useCallback, useEffect } from 'react';
import type {
  AuthStatus,
  FabricWorkspace,
  FabricDataflow,
  DataflowQuery,
  QueryResult,
  LlmProvider,
  LlmResult,
  LlmAvailability,
} from '../types/api';

const api = typeof window !== 'undefined' ? (window as any).pqWorkbench : undefined;

// Mock data used when the IPC bridge is unavailable (running in browser dev mode)
const MOCK_WORKSPACES: FabricWorkspace[] = [
  { id: 'ws-1', displayName: 'Contoso Analytics', description: 'Production workspace' },
  { id: 'ws-2', displayName: 'Sandbox', description: 'Dev/test workspace' },
];

const MOCK_DATAFLOWS: FabricDataflow[] = [
  { id: 'df-1', displayName: 'Sales Pipeline' },
  { id: 'df-2', displayName: 'Customer ETL' },
];

const MOCK_QUERY_RESULT: QueryResult = {
  columns: [
    { name: 'CustomerID', type: 'Int64', nullable: false },
    { name: 'Name', type: 'Text', nullable: false },
    { name: 'Revenue', type: 'Currency', nullable: true },
    { name: 'Region', type: 'Text', nullable: true },
    { name: 'JoinDate', type: 'Date', nullable: false },
  ],
  rows: [
    { CustomerID: 1, Name: 'Contoso Ltd', Revenue: 125000, Region: 'West', JoinDate: '2023-01-15' },
    { CustomerID: 2, Name: 'Fabrikam Inc', Revenue: 89000, Region: 'East', JoinDate: '2023-03-22' },
    { CustomerID: 3, Name: 'Northwind Traders', Revenue: 204000, Region: 'Central', JoinDate: '2022-11-01' },
    { CustomerID: 4, Name: 'Adventure Works', Revenue: 167000, Region: 'West', JoinDate: '2023-06-10' },
    { CustomerID: 5, Name: 'Wide World Imports', Revenue: null, Region: 'East', JoinDate: '2024-01-05' },
  ],
  rowCount: 5,
  executionTimeMs: 1243,
};

export function useFabric() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ signedIn: false });
  const [workspaces, setWorkspaces] = useState<FabricWorkspace[]>([]);
  const [dataflows, setDataflows] = useState<FabricDataflow[]>([]);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queries, setQueries] = useState<DataflowQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-check auth status on mount
  useEffect(() => {
    (async () => {
      try {
        if (api) {
          const status = await api.auth.getStatus();
          setAuthStatus(status);
          if (status.signedIn) {
            const ws = await api.fabric.listWorkspaces();
            setWorkspaces(ws);
          }
        }
      } catch { /* not logged in or MCP not ready */ }
    })();
  }, []);

  // Listen for device code events from main process
  useEffect(() => {
    if (api?.auth?.onDeviceCode) {
      api.auth.onDeviceCode((data: { userCode: string; verificationUri: string; message: string }) => {
        setError(`Enter code: ${data.userCode} at ${data.verificationUri}`);
      });
    }
  }, []);

  const signIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (api) {
        // This blocks until device code auth completes
        const status = await api.auth.signIn();
        setAuthStatus(status);
        setError(null);
      } else {
        setAuthStatus({ signedIn: true, userName: 'Dev User', tenantId: 'dev-tenant' });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (api) await api.auth.signOut();
      setAuthStatus({ signedIn: false });
      setWorkspaces([]);
      setDataflows([]);
      setQueryResult(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ws = api ? await api.fabric.listWorkspaces() : MOCK_WORKSPACES;
      setWorkspaces(ws);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDataflows = useCallback(async (workspaceId: string) => {
    setLoading(true);
    setError(null);
    setQueries([]);
    try {
      const dfs = api ? await api.fabric.listDataflows(workspaceId) : MOCK_DATAFLOWS;
      setDataflows(dfs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQueries = useCallback(async (workspaceId: string, dataflowId: string) => {
    try {
      const qs = api ? await api.fabric.getQueries(workspaceId, dataflowId) : [];
      setQueries(qs);
    } catch {
      setQueries([]);
    }
  }, []);

  const createDataflow = useCallback(async (workspaceId: string) => {
    setLoading(true);
    setError(null);
    try {
      const name = `PQWorkbench_${Date.now()}`;
      const df = api
        ? await api.fabric.createDataflow(workspaceId, name)
        : { id: `df-new-${Date.now()}`, displayName: name };
      setDataflows((prev) => [...prev, df]);
      return df;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const executeQuery = useCallback(
    async (workspaceId: string, dataflowId: string, expression: string, topN?: number, queryName?: string, originalDocument?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = api
          ? await api.fabric.executeQuery(workspaceId, dataflowId, expression, topN, queryName, originalDocument)
          : MOCK_QUERY_RESULT;
        setQueryResult(result);
        return result;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const generateMCode = useCallback(
    async (provider: LlmProvider, prompt: string, context?: string[]): Promise<LlmResult | null> => {
      setLoading(true);
      setError(null);
      try {
        if (api) {
          const result = await api.llm.generateMCode(provider, prompt, context);
          console.log('[useFabric] LLM result:', JSON.stringify(result));
          return result as LlmResult;
        }
        return {
          mCode: `let\n    Source = Sql.Database("server", "db"),\n    Result = Table.SelectRows(Source, each [Status] = "Active")\nin\n    Result`,
          rawOutput: '(mock LLM response)',
        };
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const checkLlmAvailability = useCallback(async (): Promise<LlmAvailability> => {
    try {
      if (api) return await api.llm.checkAvailability();
      return { 'gh-copilot': true, claude: false };
    } catch {
      return { 'gh-copilot': false, claude: false };
    }
  }, []);

  return {
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
  };
}
