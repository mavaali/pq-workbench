import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/channels';
import { mcpClient } from './mcp-client';
import * as auth from './auth';
import * as fabric from './fabric';
import * as llm from './llm';

export function registerIpcHandlers(): void {
  // Auth
  ipcMain.handle(IPC_CHANNELS.AUTH_SIGN_IN, async () => {
    return auth.signIn();
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_SIGN_OUT, async () => {
    return auth.signOut();
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_STATUS, async () => {
    return auth.getStatus();
  });

  // MCP server status
  ipcMain.handle(IPC_CHANNELS.MCP_STATUS, async () => {
    return { connected: mcpClient.connected };
  });

  // Fabric
  ipcMain.handle(
    IPC_CHANNELS.FABRIC_LIST_WORKSPACES,
    async () => {
      return fabric.listWorkspaces();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FABRIC_LIST_DATAFLOWS,
    async (_e: IpcMainInvokeEvent, workspaceId: string) => {
      if (!workspaceId || typeof workspaceId !== 'string') {
        throw new Error('workspaceId is required');
      }
      return fabric.listDataflows(workspaceId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FABRIC_CREATE_DATAFLOW,
    async (_e: IpcMainInvokeEvent, workspaceId: string, name: string) => {
      if (!workspaceId || typeof workspaceId !== 'string') {
        throw new Error('workspaceId is required');
      }
      if (!name || typeof name !== 'string') {
        throw new Error('name is required');
      }
      return fabric.createDataflow(workspaceId, name);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FABRIC_EXECUTE_QUERY,
    async (
      _e: IpcMainInvokeEvent,
      workspaceId: string,
      dataflowId: string,
      expression: string,
      topN?: number
    ) => {
      if (!workspaceId || typeof workspaceId !== 'string') {
        throw new Error('workspaceId is required');
      }
      if (!dataflowId || typeof dataflowId !== 'string') {
        throw new Error('dataflowId is required');
      }
      if (!expression || typeof expression !== 'string') {
        throw new Error('expression is required');
      }
      return fabric.evaluateQuery(workspaceId, dataflowId, expression, topN);
    }
  );

  // LLM
  ipcMain.handle(
    IPC_CHANNELS.LLM_GENERATE,
    async (
      _e: IpcMainInvokeEvent,
      provider: llm.LlmProvider,
      prompt: string,
      context?: string[]
    ) => {
      if (!provider || !['gh-copilot', 'claude'].includes(provider)) {
        throw new Error('provider must be "gh-copilot" or "claude"');
      }
      if (!prompt || typeof prompt !== 'string') {
        throw new Error('prompt is required');
      }
      return llm.generateMCode(provider, prompt, context);
    }
  );

  ipcMain.handle(IPC_CHANNELS.LLM_CHECK_AVAILABILITY, async () => {
    return llm.checkAvailability();
  });
}
