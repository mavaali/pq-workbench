// ── Auth ──
export interface AuthStatus {
  signedIn: boolean;
  userName?: string;
  tenantId?: string;
}

// ── Fabric ──
export interface FabricWorkspace {
  id: string;
  displayName: string;
  description?: string;
  capacityId?: string;
}

export interface FabricDataflow {
  id: string;
  displayName: string;
  description?: string;
}

export interface FabricEligibility {
  eligible: boolean;
  capacityCount: number;
  fabricCapableCount: number;
  reason?: string;
}

export interface QueryResult {
  columns: ColumnSchema[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  /** First row's value from the "PQ Arrow Metadata" column when present in
   *  the executeQuery response. Hidden from the user-facing grid (#45) but
   *  surfaced in Query Info as a diagnostic. */
  pqArrowMetadata?: string;
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
}

export interface FabricError {
  code: string;
  message: string;
  statusCode?: number;
}

// ── Dataflow Queries ──
export interface DataflowQuery {
  name: string;
  expression: string;
}

// ── LLM ──
export type LlmProvider = 'gh-copilot' | 'claude';

export interface LlmResult {
  mCode: string;
  rawOutput: string;
}

export type AuthState = 'authenticated' | 'unauthenticated' | 'unknown';

export interface LlmProviderStatus {
  cliInstalled: boolean;
  auth: AuthState;
}

export type LlmAvailability = Record<LlmProvider, LlmProviderStatus>;

// ── IPC Bridge ──
export interface PqWorkbenchApi {
  auth: {
    signIn: () => Promise<AuthStatus>;
    signOut: () => Promise<void>;
    getStatus: () => Promise<AuthStatus>;
  };
  fabric: {
    listWorkspaces: () => Promise<FabricWorkspace[]>;
    listDataflows: (workspaceId: string) => Promise<FabricDataflow[]>;
    checkEligibility: () => Promise<FabricEligibility>;
    createDataflow: (workspaceId: string, name: string) => Promise<FabricDataflow>;
    executeQuery: (
      workspaceId: string,
      dataflowId: string,
      expression: string,
      topN?: number
    ) => Promise<QueryResult>;
    getQueries: (
      workspaceId: string,
      dataflowId: string
    ) => Promise<DataflowQuery[]>;
  };
  llm: {
    generateMCode: (
      provider: LlmProvider,
      prompt: string,
      context?: string[]
    ) => Promise<LlmResult>;
    checkAvailability: () => Promise<LlmAvailability>;
  };
}

declare global {
  interface Window {
    pqWorkbench: PqWorkbenchApi;
  }
}
