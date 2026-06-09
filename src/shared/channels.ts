export const IPC_CHANNELS = {
  AUTH_SIGN_IN: 'auth:sign-in',
  AUTH_SIGN_OUT: 'auth:sign-out',
  AUTH_STATUS: 'auth:status',
  FABRIC_LIST_WORKSPACES: 'fabric:list-workspaces',
  FABRIC_LIST_DATAFLOWS: 'fabric:list-dataflows',
  FABRIC_CREATE_DATAFLOW: 'fabric:create-dataflow',
  FABRIC_EXECUTE_QUERY: 'fabric:execute-query',
  LLM_GENERATE: 'llm:generate',
  LLM_CHECK_AVAILABILITY: 'llm:check-availability',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

const ALLOWED_CHANNELS: ReadonlySet<string> = new Set(Object.values(IPC_CHANNELS));

export function isAllowedChannel(channel: string): boolean {
  return ALLOWED_CHANNELS.has(channel);
}
