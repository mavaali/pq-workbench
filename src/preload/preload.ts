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
      topN?: number
    ) => invoke(IPC_CHANNELS.FABRIC_EXECUTE_QUERY, workspaceId, dataflowId, expression, topN),
  },
  llm: {
    generateMCode: (provider: string, prompt: string, context?: string[]) =>
      invoke(IPC_CHANNELS.LLM_GENERATE, provider, prompt, context),
    checkAvailability: () => invoke(IPC_CHANNELS.LLM_CHECK_AVAILABILITY),
  },
});
