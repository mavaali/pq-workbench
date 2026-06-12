import { getToken } from './auth';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const FABRIC_BASE = 'https://api.fabric.microsoft.com/v1';
const PBI_V2_BASE = 'https://api.powerbi.com/v2.0';

export interface FabricConnectionDetails {
  type: string;
  path: string;
}

export interface FabricConnection {
  id: string;
  displayName: string;
  connectivityType?: string;
  privacyLevel?: string;
  connectionDetails: FabricConnectionDetails;
  /** Present when the connection has authenticated credentials; null/undefined otherwise. */
  credentialDetails?: {
    credentialType?: string;
    singleSignOnType?: string;
    connectionEncryption?: string;
    skipTestConnection?: boolean;
  } | null;
  gatewayId?: string;
}

export interface CloudDatasourceInfo {
  id: string;
  clusterId: string;
}

interface ClusterCache {
  data: CloudDatasourceInfo[];
  expiresAt: number;
}

let clusterCache: ClusterCache | null = null;
const CLUSTER_CACHE_MS = 5 * 60 * 1000;

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function fetchJsonOrThrow<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await authedFetch(url, init);
  if (!res.ok) {
    let body: string;
    try {
      body = JSON.stringify(await res.json());
    } catch {
      body = await res.text();
    }
    throw new Error(`${init.method || 'GET'} ${url} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * GET https://api.fabric.microsoft.com/v1/connections
 * Returns all connections the authenticated user has permission to see,
 * across all gateway clusters (paginated via continuationToken).
 */
export async function listConnections(): Promise<FabricConnection[]> {
  const all: FabricConnection[] = [];
  let token: string | undefined;
  let page = 0;
  do {
    const url = token
      ? `${FABRIC_BASE}/connections?continuationToken=${encodeURIComponent(token)}`
      : `${FABRIC_BASE}/connections`;
    const data = await fetchJsonOrThrow<{
      value: FabricConnection[];
      continuationToken?: string;
    }>(url);
    all.push(...(data.value || []));
    token = data.continuationToken;
    page++;
    if (page > 50) {
      console.warn('[connections] aborting pagination after 50 pages');
      break;
    }
  } while (token);
  console.log(`[connections] listConnections → ${all.length} connections across ${page} pages`);
  return all;
}

/**
 * GET https://api.powerbi.com/v2.0/myorg/me/gatewayClusterDatasources
 * Used to map a connection's DatasourceId → ClusterId, which is required for the
 * `{ClusterId, DatasourceId}` composite format in querymetadata.json binding.
 * Results are cached for 5 minutes (matches the MCP behavior).
 */
export async function listGatewayClusterDatasources(
  forceRefresh = false
): Promise<CloudDatasourceInfo[]> {
  if (!forceRefresh && clusterCache && clusterCache.expiresAt > Date.now()) {
    return clusterCache.data;
  }
  const data = await fetchJsonOrThrow<{ value: CloudDatasourceInfo[] }>(
    `${PBI_V2_BASE}/myorg/me/gatewayClusterDatasources`
  );
  const datasources = data.value || [];
  clusterCache = { data: datasources, expiresAt: Date.now() + CLUSTER_CACHE_MS };
  console.log(`[connections] gatewayClusterDatasources → ${datasources.length} datasources`);
  return datasources;
}

export async function getClusterIdForConnection(connectionId: string): Promise<string | null> {
  const datasources = await listGatewayClusterDatasources();
  const match = datasources.find((d) => d.id.toLowerCase() === connectionId.toLowerCase());
  return match ? match.clusterId : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataflow definition: read, parse bound connections, mutate, write back
// ─────────────────────────────────────────────────────────────────────────────

export interface DefinitionPart {
  path: string;
  payload: string;
  payloadType: 'InlineBase64';
}

export interface DataflowDefinition {
  parts: DefinitionPart[];
}

export interface BoundConnection {
  /** Either a plain GUID (legacy) or a JSON string `{ClusterId, DatasourceId}` (Fabric format) */
  connectionId: string;
  /** Extracted DatasourceId for matching — always a GUID, regardless of which format `connectionId` uses */
  datasourceId: string;
  /** Connection kind from querymetadata.json (e.g. "SQL", "Lakehouse", "Web") */
  kind: string;
  /** Path string from querymetadata.json (format varies per kind) */
  path: string;
}

const DATASOURCE_ID_REGEX = /"DatasourceId"\s*:\s*"([0-9a-fA-F-]{36})"/;

function extractDatasourceId(connectionIdValue: string): string {
  // Composite format: {"ClusterId":"...","DatasourceId":"..."}
  const m = connectionIdValue.match(DATASOURCE_ID_REGEX);
  if (m) return m[1];
  // Plain GUID
  return connectionIdValue;
}

/**
 * Fetches the full dataflow definition and decodes mashup.pq + querymetadata.json.
 * Returns the raw definition (for round-tripping back to updateDefinition) plus
 * decoded views of the two parts we care about.
 */
export async function getDataflowDefinition(
  workspaceId: string,
  dataflowId: string
): Promise<{
  definition: DataflowDefinition;
  mashup: string | null;
  queryMetadata: Record<string, unknown> | null;
  boundConnections: BoundConnection[];
}> {
  const url = `${FABRIC_BASE}/workspaces/${encodeURIComponent(workspaceId)}/items/${encodeURIComponent(dataflowId)}/getDefinition`;
  const res = await authedFetch(url, { method: 'POST', body: '{}' });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`getDefinition → ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { definition: DataflowDefinition };
  const definition = data.definition;

  const mashupPart = definition.parts?.find((p) => p.path.toLowerCase() === 'mashup.pq');
  const metadataPart = definition.parts?.find((p) => p.path.toLowerCase() === 'querymetadata.json');

  const mashup = mashupPart ? Buffer.from(mashupPart.payload, 'base64').toString('utf-8') : null;
  let queryMetadata: Record<string, unknown> | null = null;
  if (metadataPart) {
    try {
      const raw = Buffer.from(metadataPart.payload, 'base64').toString('utf-8');
      queryMetadata = JSON.parse(raw);
    } catch (e) {
      console.warn('[connections] failed to parse querymetadata.json:', e);
    }
  }

  const boundConnections = parseBoundConnections(queryMetadata);

  return { definition, mashup, queryMetadata, boundConnections };
}

export function parseBoundConnections(metadata: Record<string, unknown> | null): BoundConnection[] {
  if (!metadata || !Array.isArray(metadata.connections)) return [];
  const result: BoundConnection[] = [];
  for (const entry of metadata.connections as unknown[]) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const cid = typeof e.connectionId === 'string' ? e.connectionId : null;
    if (!cid) continue;
    result.push({
      connectionId: cid,
      datasourceId: extractDatasourceId(cid),
      kind: typeof e.kind === 'string' ? e.kind : '',
      path: typeof e.path === 'string' ? e.path : '',
    });
  }
  return result;
}

/**
 * Add (or replace) connections on a dataflow. Mirrors MCP semantics:
 *  - dedups against existing bindings (matches plain GUID, composite, and DatasourceId-in-composite)
 *  - looks up ClusterId per connection; uses composite `{ClusterId, DatasourceId}` when available, plain GUID otherwise
 *  - sets `documentLocale = "en-US"` if missing
 *  - round-trips only querymetadata.json; all other parts are preserved verbatim
 *
 * Returns the new bound-connections list (post-mutation) for caller verification.
 */
export async function addConnectionsToDataflow(
  workspaceId: string,
  dataflowId: string,
  connectionIds: string[],
  options: { clearExisting?: boolean } = {}
): Promise<{
  added: string[];
  skipped: string[];
  bindings: BoundConnection[];
  noopWrite: boolean;
}> {
  if (!connectionIds.length && !options.clearExisting) {
    throw new Error('addConnectionsToDataflow: connectionIds is empty and clearExisting is false');
  }

  // 1. Pull definition + current bindings + full connection metadata for kind/path
  const [{ definition, queryMetadata }, allConnections] = await Promise.all([
    getDataflowDefinition(workspaceId, dataflowId),
    listConnections(),
  ]);

  const metadataPart = definition.parts?.find((p) => p.path.toLowerCase() === 'querymetadata.json');
  if (!metadataPart) {
    throw new Error('addConnectionsToDataflow: dataflow definition has no querymetadata.json part');
  }

  const connById = new Map(allConnections.map((c) => [c.id.toLowerCase(), c]));
  const unknownIds = connectionIds.filter((id) => !connById.has(id.toLowerCase()));
  if (unknownIds.length) {
    throw new Error(
      `addConnectionsToDataflow: connection IDs not found in /v1/connections: ${unknownIds.join(', ')}`
    );
  }

  // 2. Resolve ClusterIds in parallel
  const clusterPairs = await Promise.all(
    connectionIds.map(async (id) => ({ id, clusterId: await getClusterIdForConnection(id) }))
  );
  const clusterById = new Map(clusterPairs.map((p) => [p.id.toLowerCase(), p.clusterId]));

  // 3. Build updated metadata
  const metadata: Record<string, unknown> = queryMetadata ? { ...queryMetadata } : {};
  if (!metadata.documentLocale) metadata.documentLocale = 'en-US';

  const existing = options.clearExisting
    ? []
    : Array.isArray(metadata.connections)
      ? ([...(metadata.connections as unknown[])])
      : [];

  const added: string[] = [];
  const skipped: string[] = [];

  for (const connId of connectionIds) {
    const conn = connById.get(connId.toLowerCase())!;
    const clusterId = clusterById.get(connId.toLowerCase()) ?? null;
    const connectionIdValue = clusterId
      ? JSON.stringify({ ClusterId: clusterId, DatasourceId: connId })
      : connId;

    const alreadyBound = existing.some((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      const e = entry as Record<string, unknown>;
      const cid = typeof e.connectionId === 'string' ? e.connectionId : '';
      if (!cid) return false;
      return (
        cid === connId ||
        cid === connectionIdValue ||
        cid.toLowerCase().includes(`"datasourceid":"${connId.toLowerCase()}"`)
      );
    });

    if (alreadyBound) {
      skipped.push(connId);
      continue;
    }

    existing.push({
      connectionId: connectionIdValue,
      kind: conn.connectionDetails?.type || '',
      path: conn.connectionDetails?.path || '',
    });
    added.push(connId);
  }

  metadata.connections = existing;

  // No-op short-circuit: if nothing changed and we're not clearing, skip the write entirely
  if (!added.length && !options.clearExisting) {
    return {
      added: [],
      skipped,
      bindings: parseBoundConnections(metadata),
      noopWrite: true,
    };
  }

  // 4. Re-encode and push
  const newJson = JSON.stringify(metadata, null, 2);
  metadataPart.payload = Buffer.from(newJson, 'utf-8').toString('base64');
  for (const p of definition.parts) {
    if (!p.payloadType) p.payloadType = 'InlineBase64';
  }

  const updateUrl = `${FABRIC_BASE}/workspaces/${encodeURIComponent(workspaceId)}/items/${encodeURIComponent(dataflowId)}/updateDefinition`;
  const res = await authedFetch(updateUrl, {
    method: 'POST',
    body: JSON.stringify({ definition }),
  });
  // updateDefinition typically returns 200 or 202 (long-running). We accept both.
  if (!res.ok && res.status !== 202) {
    const body = await res.text();
    throw new Error(`updateDefinition → ${res.status}: ${body}`);
  }
  if (res.status === 202) {
    console.log('[connections] updateDefinition → 202 Accepted (long-running operation)');
  }

  return {
    added,
    skipped,
    bindings: parseBoundConnections(metadata),
    noopWrite: false,
  };
}

/**
 * Diagnostic for a specific dataflow: surfaces mashup preview, current bindings,
 * and the full candidate list grouped by type. Use from DevTools to verify the
 * read path before triggering any mutation.
 */
export async function inspectDataflow(
  workspaceId: string,
  dataflowId: string
): Promise<{
  mashupPreview: string;
  mashupLength: number;
  boundConnections: BoundConnection[];
  candidatesByType: Record<string, { id: string; path: string; lastBound: string | null }[]>;
}> {
  const [{ mashup, boundConnections }, allConnections] = await Promise.all([
    getDataflowDefinition(workspaceId, dataflowId),
    listConnections(),
  ]);

  const candidatesByType: Record<
    string,
    { id: string; path: string; lastBound: string | null }[]
  > = {};
  for (const c of allConnections) {
    const t = c.connectionDetails?.type || 'Unknown';
    if (!candidatesByType[t]) candidatesByType[t] = [];
    const recency = (c as unknown as { connectionRecency?: { myLastBoundDateTime?: string | null } })
      .connectionRecency;
    candidatesByType[t].push({
      id: c.id,
      path: c.connectionDetails?.path || '',
      lastBound: recency?.myLastBoundDateTime ?? null,
    });
  }
  for (const t of Object.keys(candidatesByType)) {
    candidatesByType[t].sort((a, b) => {
      if (!a.lastBound && !b.lastBound) return 0;
      if (!a.lastBound) return 1;
      if (!b.lastBound) return -1;
      return b.lastBound.localeCompare(a.lastBound);
    });
  }

  return {
    mashupPreview: mashup ? mashup.slice(0, 600) : '',
    mashupLength: mashup ? mashup.length : 0,
    boundConnections,
    candidatesByType,
  };
}

/**
 * Dev helper: dump full inspectDataflow output (plus full mashup) to ~/Desktop/pq-inspect.json.
 * Returns the destination path.
 */
export async function dumpInspectToFile(
  workspaceId: string,
  dataflowId: string
): Promise<string> {
  const [{ mashup, boundConnections, queryMetadata }, allConnections] = await Promise.all([
    getDataflowDefinition(workspaceId, dataflowId),
    listConnections(),
  ]);

  const candidatesByType: Record<string, unknown[]> = {};
  for (const c of allConnections) {
    const t = c.connectionDetails?.type || 'Unknown';
    if (!candidatesByType[t]) candidatesByType[t] = [];
    const recency = (c as unknown as { connectionRecency?: { myLastBoundDateTime?: string | null } })
      .connectionRecency;
    candidatesByType[t].push({
      id: c.id,
      path: c.connectionDetails?.path || '',
      lastBound: recency?.myLastBoundDateTime ?? null,
    });
  }

  const out = {
    workspaceId,
    dataflowId,
    boundConnections,
    queryMetadataConnectionsRaw: (queryMetadata as { connections?: unknown })?.connections ?? null,
    mashupLength: mashup?.length ?? 0,
    mashupFull: mashup,
    candidatesByType,
  };

  const dest = path.join(os.homedir(), 'Desktop', 'pq-inspect.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  return dest;
}

/**
 * Smoke-test entry point: calls both endpoints, returns counts + a sample so we can
 * confirm the live token reaches both surfaces. Returns shape suitable for DevTools logging.
 */
export async function diagnoseConnections(): Promise<{
  connections: { count: number; sample: FabricConnection[]; types: Record<string, number> };
  cloudDatasources: { count: number; sample: CloudDatasourceInfo[]; matchedCount: number };
  unmatchedConnections: string[];
}> {
  const [connections, datasources] = await Promise.all([
    listConnections(),
    listGatewayClusterDatasources(true),
  ]);

  const datasourceIds = new Set(datasources.map((d) => d.id.toLowerCase()));
  const matchedCount = connections.filter((c) => datasourceIds.has(c.id.toLowerCase())).length;
  const unmatched = connections
    .filter((c) => !datasourceIds.has(c.id.toLowerCase()))
    .map((c) => `${c.displayName} (${c.connectionDetails?.type || '?'})`);

  const types: Record<string, number> = {};
  for (const c of connections) {
    const t = c.connectionDetails?.type || 'Unknown';
    types[t] = (types[t] || 0) + 1;
  }

  return {
    connections: {
      count: connections.length,
      sample: connections.slice(0, 5),
      types,
    },
    cloudDatasources: {
      count: datasources.length,
      sample: datasources.slice(0, 5),
      matchedCount,
    },
    unmatchedConnections: unmatched.slice(0, 20),
  };
}

// 
// Source detection + binding analysis
// 

/**
 * Maps an M source function (e.g. `Lakehouse.Contents`) to the set of
 * `connectionDetails.type` values that can satisfy it. A bound connection of
 * ANY type in the set covers the source.
 *
 * Refs:
 *  - Lakehouse / Warehouse: Fabric-native
 *  - Sql.Database(s): SQL connectors
 *  - Kusto.Contents / AzureDataExplorer.Contents: ADX (both type names seen in tenants)
 *  - Web.Contents / Web.Page / Web.BrowserContents / OData.Feed: Web
 *  - AzureStorage.Blobs / AzureStorage.BlobContents: AzureBlobs
 *  - AzureStorage.DataLake / Adls.Contents: AzureDataLakeStorage
 *  - SharePoint.*: SharePoint
 *  - AnalysisServices.Database(s): AnalysisServices
 *  - GoogleBigQuery.Database: GoogleBigQuery
 *  - PowerPlatform.Dataflows / PowerBI.Dataflows: PowerPlatformDataflows
 *  - PowerBI.Datasets: PowerBIDatasets
 */
const SOURCE_FUNCTION_PATTERNS: { regex: RegExp; sourceKind: string; acceptableTypes: string[] }[] = [
  { regex: /\bLakehouse\.Contents\s*\(/g, sourceKind: 'Lakehouse', acceptableTypes: ['Lakehouse'] },
  { regex: /\bWarehouse\.Contents\s*\(/g, sourceKind: 'Warehouse', acceptableTypes: ['Warehouse'] },
  { regex: /\bFabric\.Warehouse\s*\(/g, sourceKind: 'Warehouse', acceptableTypes: ['Warehouse'] },
  { regex: /\bSql\.Databases?\s*\(/g, sourceKind: 'SQL', acceptableTypes: ['SQL', 'FabricSql'] },
  { regex: /\bKusto\.Contents\s*\(/g, sourceKind: 'AzureDataExplorer', acceptableTypes: ['AzureDataExplorer', 'Kusto'] },
  { regex: /\bAzureDataExplorer\.Contents\s*\(/g, sourceKind: 'AzureDataExplorer', acceptableTypes: ['AzureDataExplorer', 'Kusto'] },
  { regex: /\bWeb\.(Contents|Page|BrowserContents)\s*\(/g, sourceKind: 'Web', acceptableTypes: ['Web'] },
  { regex: /\bOData\.Feed\s*\(/g, sourceKind: 'Web', acceptableTypes: ['Web'] },
  { regex: /\bAzureStorage\.(Blobs|BlobContents)\s*\(/g, sourceKind: 'AzureBlobs', acceptableTypes: ['AzureBlobs'] },
  { regex: /\bAzureStorage\.DataLake(Contents)?\s*\(/g, sourceKind: 'AzureDataLakeStorage', acceptableTypes: ['AzureDataLakeStorage', 'DataLake'] },
  { regex: /\bAdls\.Contents\s*\(/g, sourceKind: 'AzureDataLakeStorage', acceptableTypes: ['AzureDataLakeStorage', 'DataLake'] },
  { regex: /\bSharePoint\.(Files|Tables|Contents)\s*\(/g, sourceKind: 'SharePoint', acceptableTypes: ['SharePoint'] },
  { regex: /\bAnalysisServices\.Databases?\s*\(/g, sourceKind: 'AnalysisServices', acceptableTypes: ['AnalysisServices'] },
  { regex: /\bGoogleBigQuery\.Database\s*\(/g, sourceKind: 'GoogleBigQuery', acceptableTypes: ['GoogleBigQuery'] },
  { regex: /\b(PowerPlatform|PowerBI)\.Dataflows\s*\(/g, sourceKind: 'PowerPlatformDataflows', acceptableTypes: ['PowerPlatformDataflows'] },
  { regex: /\bPowerBI\.Datasets\s*\(/g, sourceKind: 'PowerBIDatasets', acceptableTypes: ['PowerBIDatasets'] },
];

export interface DetectedSource {
  sourceKind: string;
  acceptableTypes: string[];
  occurrences: number;
}

/** A specific URL the mashup references via Web.Contents / Web.Page / OData.Feed / etc. */
export interface DetectedWebUrl {
  url: string;
  occurrences: number;
}

/**
 * Scan an M document (section doc or raw expression) for external data source
 * function calls. Returns distinct source kinds with the connection-type set
 * that can satisfy each. Pure function, no I/O.
 */
export function detectSourceTypesInMashup(mashup: string): DetectedSource[] {
  if (!mashup) return [];
  const stripped = stripMComments(mashup);
  const byKind = new Map<string, DetectedSource>();
  for (const pat of SOURCE_FUNCTION_PATTERNS) {
    pat.regex.lastIndex = 0;
    const matches = stripped.match(pat.regex);
    if (!matches || !matches.length) continue;
    const existing = byKind.get(pat.sourceKind);
    if (existing) {
      existing.occurrences += matches.length;
    } else {
      byKind.set(pat.sourceKind, {
        sourceKind: pat.sourceKind,
        acceptableTypes: [...pat.acceptableTypes],
        occurrences: matches.length,
      });
    }
  }
  return Array.from(byKind.values());
}

const WEB_URL_FUNC_REGEX = /\b(?:Web\.(?:Contents|Page|BrowserContents)|OData\.Feed)\s*\(\s*"([^"]+)"/g;

/**
 * Strip M comments without mangling URLs. Line comments are only treated
 * as comment starts when at start-of-line or preceded by whitespace — this
 * preserves `://` inside URL literals. Block comments (slash-star ... star-slash)
 * are stripped verbatim (they cannot appear inside string literals in M).
 *
 * This is intentionally NOT a full M lexer — strings containing literal
 * comment-start sequences would be miscategorized. Acceptable trade-off for
 * the source-detection use case; the much more common case is URLs.
 */
function stripMComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[\s;,\(\[\{])\/\/[^\n\r]*/g, '$1');
}

/**
 * Extract first-argument URLs from Web.Contents/Web.Page/Web.BrowserContents/OData.Feed
 * calls. Only literal string URLs are extracted; expressions like
 * `Web.Contents(baseUrl & path)` are not detected.
 */
export function extractWebUrlsFromMashup(mashup: string): DetectedWebUrl[] {
  if (!mashup) return [];
  const stripped = stripMComments(mashup);
  const counts = new Map<string, number>();
  let m: RegExpExecArray | null;
  WEB_URL_FUNC_REGEX.lastIndex = 0;
  while ((m = WEB_URL_FUNC_REGEX.exec(stripped)) !== null) {
    const url = m[1];
    counts.set(url, (counts.get(url) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([url, occurrences]) => ({ url, occurrences }));
}

/**
 * Parse a URL into normalized host + lowercased path prefix for comparison.
 * Returns null if the value isn't a usable absolute URL.
 */
function normalizeUrl(value: string): { host: string; pathPrefix: string } | null {
  try {
    const u = new URL(value);
    return {
      host: u.host.toLowerCase(),
      // Strip trailing slash for prefix matching consistency
      pathPrefix: u.pathname.replace(/\/+$/, ''),
    };
  } catch {
    return null;
  }
}

/**
 * Compute how well a candidate Web connection's path "covers" a target URL.
 * Returns 0 if hosts don't match; otherwise returns the length of the matching
 * path prefix (in characters), with 1 for an empty-path connection matching the
 * same host. Higher = better match. Used for ranking AND for the coverage check
 * (any positive score qualifies as type-level cover; ranking picks the best).
 */
export function urlMatchScore(connectionPath: string, targetUrl: string): number {
  const conn = normalizeUrl(connectionPath);
  const target = normalizeUrl(targetUrl);
  if (!conn || !target) return 0;
  if (conn.host !== target.host) return 0;
  // Same host: length of common path prefix is the score; empty path = score 1
  if (!conn.pathPrefix) return 1;
  if (target.pathPrefix.toLowerCase().startsWith(conn.pathPrefix.toLowerCase())) {
    return conn.pathPrefix.length + 1;
  }
  return 0;
}

export interface ConnectionCandidate {
  id: string;
  type: string;
  path: string;
  displayName: string | null;
  lastBound: string | null;
  myLastBound: string | null;
  /** True when the connection has authenticated credentials configured. */
  hasCredentials: boolean;
  /** Credential type if known (OAuth2, Basic, Key, etc.) — for UI display. */
  credentialType: string | null;
}

export interface MissingSourceBinding {
  sourceKind: string;
  acceptableTypes: string[];
  occurrences: number;
  /** Present only when the missing binding is URL-scoped (Web/SharePoint). */
  url?: string;
  candidates: ConnectionCandidate[];
}

export type BindingAnalysis =
  | {
      ready: true;
      detected: DetectedSource[];
      webUrls: DetectedWebUrl[];
      bound: BoundConnection[];
      mashupLength: number;
    }
  | {
      ready: false;
      detected: DetectedSource[];
      webUrls: DetectedWebUrl[];
      bound: BoundConnection[];
      missing: MissingSourceBinding[];
      mashupLength: number;
    };

/**
 * Decide whether the supplied mashup (or the dataflow's current mashup, if not
 * supplied) is ready to execute against its current connection bindings.
 *
 * If `mashupOverride` is provided, it is used for detection (covers the case
 * where the user is about to execute an ad-hoc M expression that differs from
 * the saved dataflow). Otherwise the dataflow's persisted mashup is scanned.
 *
 * Candidates per missing source are ranked: user's recent bindings first
 * (`myLastBoundDateTime` desc), then any-user recent (`lastBoundDateTime` desc),
 * then by id for determinism.
 */
export async function analyzeForBinding(
  workspaceId: string,
  dataflowId: string,
  mashupOverride?: string
): Promise<BindingAnalysis> {
  const [{ mashup, boundConnections }, allConnections] = await Promise.all([
    getDataflowDefinition(workspaceId, dataflowId),
    listConnections(),
  ]);

  const scanned = mashupOverride && mashupOverride.trim().length ? mashupOverride : (mashup || '');
  const detected = detectSourceTypesInMashup(scanned);
  const webUrls = extractWebUrlsFromMashup(scanned);

  // Index connections by id so we can check whether a bound connection
  // actually has working credentials (credentialDetails != null).
  const connById = new Map(allConnections.map((c) => [c.id, c]));

  // A binding is "covered" only when its underlying connection is also
  // authenticated. Bound-but-unauthenticated connections silently fail at
  // executeQuery time ("Credentials are required to connect to the … source"),
  // so we treat them as missing and let the user pick an authenticated one.
  const usableBoundTypes = new Set(
    boundConnections
      .filter((b) => {
        const conn = connById.get(b.datasourceId);
        return !!conn?.credentialDetails;
      })
      .map((b) => b.kind)
  );
  const missing: MissingSourceBinding[] = [];

  for (const d of detected) {
    // Web sources get per-URL analysis instead of per-type
    if (d.sourceKind === 'Web') continue;

    const covered = d.acceptableTypes.some((t) => usableBoundTypes.has(t));
    if (covered) continue;
    const candidates = rankCandidates(
      allConnections.filter((c) => d.acceptableTypes.includes(c.connectionDetails?.type || ''))
    );
    missing.push({
      sourceKind: d.sourceKind,
      acceptableTypes: d.acceptableTypes,
      occurrences: d.occurrences,
      candidates,
    });
  }

  // Per-URL Web analysis: each URL must be covered by a bound Web connection
  // whose path is a prefix of the URL (host + path-prefix match) AND whose
  // underlying connection is authenticated. If not, list it as missing.
  if (webUrls.length) {
    const boundWebPaths = boundConnections
      .filter((b) => b.kind === 'Web')
      .filter((b) => !!connById.get(b.datasourceId)?.credentialDetails)
      .map((b) => b.path);
    const webConnections = allConnections.filter((c) => c.connectionDetails?.type === 'Web');

    for (const wu of webUrls) {
      const covered = boundWebPaths.some((p) => urlMatchScore(p, wu.url) > 0);
      if (covered) continue;

      const scored = webConnections
        .map((c) => ({ conn: c, score: urlMatchScore(c.connectionDetails?.path || '', wu.url) }))
        .sort((a, b) => {
          // Authenticated connections always rank above unauthenticated ones
          const ca = !!a.conn.credentialDetails;
          const cb = !!b.conn.credentialDetails;
          if (ca !== cb) return ca ? -1 : 1;
          if (a.score !== b.score) return b.score - a.score;
          // tiebreak by recency
          const ra = (a.conn as unknown as { connectionRecency?: { myLastBoundDateTime?: string | null } }).connectionRecency?.myLastBoundDateTime;
          const rb = (b.conn as unknown as { connectionRecency?: { myLastBoundDateTime?: string | null } }).connectionRecency?.myLastBoundDateTime;
          if (ra !== rb) {
            if (!ra) return 1;
            if (!rb) return -1;
            return rb.localeCompare(ra);
          }
          return a.conn.id.localeCompare(b.conn.id);
        });

      const candidates = scored.map(({ conn }) => connectionToCandidate(conn));

      missing.push({
        sourceKind: 'Web',
        acceptableTypes: ['Web'],
        occurrences: wu.occurrences,
        url: wu.url,
        candidates,
      });
    }
  }

  if (!missing.length) {
    return {
      ready: true,
      detected,
      webUrls,
      bound: boundConnections,
      mashupLength: scanned.length,
    };
  }
  return {
    ready: false,
    detected,
    webUrls,
    bound: boundConnections,
    missing,
    mashupLength: scanned.length,
  };
}

function connectionToCandidate(c: FabricConnection): ConnectionCandidate {
  const recency = (c as unknown as {
    connectionRecency?: {
      myLastBoundDateTime?: string | null;
      lastBoundDateTime?: string | null;
    };
  }).connectionRecency;
  const creds = c.credentialDetails;
  return {
    id: c.id,
    type: c.connectionDetails?.type || '',
    path: c.connectionDetails?.path || '',
    displayName: c.displayName ?? null,
    lastBound: recency?.lastBoundDateTime ?? null,
    myLastBound: recency?.myLastBoundDateTime ?? null,
    hasCredentials: !!creds,
    credentialType: creds?.credentialType ?? null,
  };
}

function rankCandidates(conns: FabricConnection[]): ConnectionCandidate[] {
  return conns.map(connectionToCandidate).sort((a, b) => {
    // Authenticated connections always rank above unauthenticated ones
    if (a.hasCredentials !== b.hasCredentials) return a.hasCredentials ? -1 : 1;
    const ma = a.myLastBound, mb = b.myLastBound;
    if (ma !== mb) {
      if (!ma) return 1;
      if (!mb) return -1;
      return mb.localeCompare(ma);
    }
    const la = a.lastBound, lb = b.lastBound;
    if (la !== lb) {
      if (!la) return 1;
      if (!lb) return -1;
      return lb.localeCompare(la);
    }
    return a.id.localeCompare(b.id);
  });
}
