import { ipcMain, IpcMainInvokeEvent, dialog, BrowserWindow } from 'electron';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IPC_CHANNELS } from '../shared/channels';
import * as auth from './auth';
import * as fabric from './fabric';
import * as connections from './connections';
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

  ipcMain.handle(IPC_CHANNELS.AUTH_POLL, async () => {
    return auth.pollAuthCompletion();
  });

  // Open terminal for CLI auth (gh auth login)
  ipcMain.handle(IPC_CHANNELS.OPEN_CLI_AUTH, async () => {
    const cmd = 'gh auth login --scopes copilot';
    if (process.platform === 'darwin') {
      execFile('osascript', ['-e', `tell application "Terminal" to do script "${cmd}"`]);
    } else if (process.platform === 'win32') {
      execFile('cmd.exe', ['/c', 'start', 'cmd', '/k', cmd]);
    } else {
      execFile('x-terminal-emulator', ['-e', cmd]);
    }
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
      topN?: number,
      queryName?: string,
      originalDocument?: string
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
      return fabric.evaluateQuery(workspaceId, dataflowId, expression, topN, queryName, originalDocument);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FABRIC_GET_QUERIES,
    async (_e: IpcMainInvokeEvent, workspaceId: string, dataflowId: string) => {
      if (!workspaceId || typeof workspaceId !== 'string') {
        throw new Error('workspaceId is required');
      }
      if (!dataflowId || typeof dataflowId !== 'string') {
        throw new Error('dataflowId is required');
      }
      return fabric.getDataflowQueries(workspaceId, dataflowId);
    }
  );

  // Connections
  ipcMain.handle(IPC_CHANNELS.CONNECTIONS_LIST, async () => {
    return connections.listConnections();
  });

  ipcMain.handle(IPC_CHANNELS.CONNECTIONS_LIST_CLUSTERS, async () => {
    return connections.listGatewayClusterDatasources(true);
  });

  ipcMain.handle(IPC_CHANNELS.CONNECTIONS_DIAGNOSE, async () => {
    return connections.diagnoseConnections();
  });

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_INSPECT_DATAFLOW,
    async (_e: IpcMainInvokeEvent, workspaceId: string, dataflowId: string) => {
      if (!workspaceId || typeof workspaceId !== 'string') {
        throw new Error('workspaceId is required');
      }
      if (!dataflowId || typeof dataflowId !== 'string') {
        throw new Error('dataflowId is required');
      }
      return connections.inspectDataflow(workspaceId, dataflowId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_BIND,
    async (
      _e: IpcMainInvokeEvent,
      workspaceId: string,
      dataflowId: string,
      connectionIds: string[],
      clearExisting?: boolean
    ) => {
      if (!workspaceId || typeof workspaceId !== 'string') {
        throw new Error('workspaceId is required');
      }
      if (!dataflowId || typeof dataflowId !== 'string') {
        throw new Error('dataflowId is required');
      }
      if (!Array.isArray(connectionIds)) {
        throw new Error('connectionIds must be an array');
      }
      return connections.addConnectionsToDataflow(workspaceId, dataflowId, connectionIds, {
        clearExisting: !!clearExisting,
      });
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_DUMP_INSPECT,
    async (_e: IpcMainInvokeEvent, workspaceId: string, dataflowId: string) => {
      return connections.dumpInspectToFile(workspaceId, dataflowId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONNECTIONS_ANALYZE,
    async (
      _e: IpcMainInvokeEvent,
      workspaceId: string,
      dataflowId: string,
      mashupOverride?: string
    ) => {
      if (!workspaceId || typeof workspaceId !== 'string') {
        throw new Error('workspaceId is required');
      }
      if (!dataflowId || typeof dataflowId !== 'string') {
        throw new Error('dataflowId is required');
      }
      return connections.analyzeForBinding(workspaceId, dataflowId, mashupOverride);
    }
  );

  // CSV export: opens native Save dialog, writes file. Returns {path} on success,
  // or {canceled: true} if user dismissed. Throws on I/O failure.
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_CSV,
    async (
      e: IpcMainInvokeEvent,
      csvContent: string,
      suggestedName?: string
    ): Promise<{ path: string } | { canceled: true }> => {
      if (typeof csvContent !== 'string') {
        throw new Error('csvContent must be a string');
      }
      const safeName = (suggestedName || 'query-results')
        .replace(/[\/\\:*?"<>|]/g, '_')
        .slice(0, 120);
      const defaultPath = path.join(
        os.homedir(),
        'Downloads',
        `${safeName}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`
      );
      const win = BrowserWindow.fromWebContents(e.sender) || undefined;
      const result = await dialog.showSaveDialog(win!, {
        title: 'Export results as CSV',
        defaultPath,
        filters: [
          { name: 'CSV', extensions: ['csv'] },
          { name: 'All files', extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePath) {
        return { canceled: true };
      }
      // UTF-8 BOM so Excel detects encoding correctly when opening
      fs.writeFileSync(result.filePath, '\uFEFF' + csvContent, 'utf-8');
      return { path: result.filePath };
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
