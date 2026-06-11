import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, isAllowedChannel } from '../shared/channels';

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (!isAllowedChannel(channel)) {
    return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld('pqWorkbench', {
  auth: {
    signIn: () => invoke(IPC_CHANNELS.AUTH_SIGN_IN),
    signOut: () => invoke<void>(IPC_CHANNELS.AUTH_SIGN_OUT),
    getStatus: () => invoke(IPC_CHANNELS.AUTH_STATUS),
    pollCompletion: () => invoke(IPC_CHANNELS.AUTH_POLL),
    onDeviceCode: (callback: (data: { userCode: string; verificationUri: string; message: string }) => void) => {
      ipcRenderer.on('auth:device-code', (_event, data) => callback(data));
    },
    openCliAuth: () => invoke<void>(IPC_CHANNELS.OPEN_CLI_AUTH),
  },
  fabric: {
    listWorkspaces: () => invoke(IPC_CHANNELS.FABRIC_LIST_WORKSPACES),
    listDataflows: (workspaceId: string) =>
      invoke(IPC_CHANNELS.FABRIC_LIST_DATAFLOWS, workspaceId),
    createDataflow: (workspaceId: string, name: string) =>
      invoke(IPC_CHANNELS.FABRIC_CREATE_DATAFLOW, workspaceId, name),
    executeQuery: (
      workspaceId: string,
      dataflowId: string,
      expression: string,
      topN?: number,
      queryName?: string,
      originalDocument?: string
    ) => invoke(IPC_CHANNELS.FABRIC_EXECUTE_QUERY, workspaceId, dataflowId, expression, topN, queryName, originalDocument),
    getQueries: (workspaceId: string, dataflowId: string) =>
      invoke(IPC_CHANNELS.FABRIC_GET_QUERIES, workspaceId, dataflowId),
  },
  connections: {
    list: () => invoke(IPC_CHANNELS.CONNECTIONS_LIST),
    listClusters: () => invoke(IPC_CHANNELS.CONNECTIONS_LIST_CLUSTERS),
    diagnose: () => invoke(IPC_CHANNELS.CONNECTIONS_DIAGNOSE),
    inspectDataflow: (workspaceId: string, dataflowId: string) =>
      invoke(IPC_CHANNELS.CONNECTIONS_INSPECT_DATAFLOW, workspaceId, dataflowId),
    bind: (workspaceId: string, dataflowId: string, connectionIds: string[], clearExisting?: boolean) =>
      invoke(IPC_CHANNELS.CONNECTIONS_BIND, workspaceId, dataflowId, connectionIds, clearExisting),
    dumpInspect: (workspaceId: string, dataflowId: string) =>
      invoke<string>(IPC_CHANNELS.CONNECTIONS_DUMP_INSPECT, workspaceId, dataflowId),
    analyze: (workspaceId: string, dataflowId: string, mashupOverride?: string) =>
      invoke(IPC_CHANNELS.CONNECTIONS_ANALYZE, workspaceId, dataflowId, mashupOverride),
  },
  llm: {
    generateMCode: (provider: string, prompt: string, context?: string[]) =>
      invoke(IPC_CHANNELS.LLM_GENERATE, provider, prompt, context),
    checkAvailability: () => invoke(IPC_CHANNELS.LLM_CHECK_AVAILABILITY),
  },
});
