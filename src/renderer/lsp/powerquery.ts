/**
 * Microsoft powerquery-language-services wired into Monaco.
 *
 * Architecture:
 *   - Vendored library JSON (standard-enUs.json + fabric-extensions.json) is loaded
 *     once at module init via LibrarySymbolUtils.createLibrary.
 *   - Each Monaco model gets a paired TextDocument + Analysis. We bump the
 *     TextDocument version on every content change and rely on the lib's internal
 *     cache (isWorkspaceCacheAllowed = true) keyed by uri + version.
 *   - Completion + Hover are registered once per monaco namespace. The providers
 *     look up per-model state via a WeakMap.
 *   - Validate runs on a 300ms debounce and pushes diagnostics through
 *     monaco.editor.setModelMarkers.
 *
 * Day-1 scope. Signature help / goto-def / rename / formatting are deferred.
 */

import type * as Monaco from 'monaco-editor';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    DiagnosticSeverity,
    CompletionItemKind as LspCompletionItemKind,
} from 'vscode-languageserver-types';
import * as PQP from '@microsoft/powerquery-parser';
import * as PQLS from '@microsoft/powerquery-language-services';

import standardLibrary from './data/standard-enUs.json';
import fabricExtensions from './data/fabric-extensions.json';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const POWERQUERY_LANGUAGE_ID = 'powerquery';
const VALIDATE_DEBOUNCE_MS = 300;
const MARKER_OWNER = 'powerquery-lsp';
const LOCALE = 'en-us';

// ---------------------------------------------------------------------------
// Library bootstrap (module-level singleton)
// ---------------------------------------------------------------------------

const allSymbols = [
    ...(standardLibrary as PQLS.LibrarySymbol.LibrarySymbol[]),
    ...(fabricExtensions as PQLS.LibrarySymbol.LibrarySymbol[]),
];

const libraryResult = PQLS.LibrarySymbolUtils.createLibrary(
    allSymbols,
    () => new Map(),
    undefined,
);

const library: PQLS.Library.ILibrary =
    libraryResult.kind === PQP.ResultKind.Ok
        ? libraryResult.value
        : libraryResult.error.library;

if (libraryResult.kind === PQP.ResultKind.Error) {
    console.warn(
        '[powerquery-lsp] %d library symbol(s) failed to convert; continuing with the rest',
        libraryResult.error.failedLibrarySymbolConversions.length,
    );
}

// ---------------------------------------------------------------------------
// Analysis settings
// ---------------------------------------------------------------------------

const inspectionSettings: PQLS.InspectionSettings = {
    ...PQP.DefaultSettings,
    isWorkspaceCacheAllowed: true,
    library,
    eachScopeById: undefined,
    typeStrategy: PQLS.TypeStrategy.Extended,
};

const analysisSettings: PQLS.AnalysisSettings = {
    inspectionSettings,
    isWorkspaceCacheAllowed: true,
    initialCorrelationId: undefined,
    traceManager: PQP.Trace.NoOpTraceManagerInstance,
};

const validationSettings: PQLS.ValidationSettings = PQLS.ValidationSettingsUtils.createValidationSettings(
    inspectionSettings,
    {
        checkDiagnosticsOnParseError: true,
        checkForDuplicateIdentifiers: true,
        checkInvokeExpressions: true,
        checkUnknownIdentifiers: true,
        source: MARKER_OWNER,
    },
);

// ---------------------------------------------------------------------------
// Per-model state
// ---------------------------------------------------------------------------

interface ModelState {
    document: TextDocument;
    version: number;
    debounceTimer: ReturnType<typeof setTimeout> | null;
    disposed: boolean;
}

const stateByModel = new WeakMap<Monaco.editor.ITextModel, ModelState>();

function getOrCreateState(model: Monaco.editor.ITextModel): ModelState {
    let state = stateByModel.get(model);
    if (state) return state;

    state = {
        document: TextDocument.create(
            model.uri.toString(),
            POWERQUERY_LANGUAGE_ID,
            1,
            model.getValue(),
        ),
        version: 1,
        debounceTimer: null,
        disposed: false,
    };
    stateByModel.set(model, state);
    return state;
}

function syncDocument(model: Monaco.editor.ITextModel): TextDocument {
    const state = getOrCreateState(model);
    const text = model.getValue();
    if (state.document.getText() !== text) {
        state.version += 1;
        state.document = TextDocument.create(
            state.document.uri,
            POWERQUERY_LANGUAGE_ID,
            state.version,
            text,
        );
    }
    return state.document;
}

function getAnalysis(model: Monaco.editor.ITextModel): PQLS.Analysis {
    const document = syncDocument(model);
    return PQLS.AnalysisUtils.analysis(document, analysisSettings);
}

// ---------------------------------------------------------------------------
// Position / kind / severity adapters
// ---------------------------------------------------------------------------

function monacoPositionToLsp(position: Monaco.Position): { line: number; character: number } {
    return { line: position.lineNumber - 1, character: position.column - 1 };
}

function buildLspKindMap(monaco: typeof Monaco): Map<number, Monaco.languages.CompletionItemKind> {
    const K = monaco.languages.CompletionItemKind;
    const m = new Map<number, Monaco.languages.CompletionItemKind>();
    m.set(LspCompletionItemKind.Text, K.Text);
    m.set(LspCompletionItemKind.Method, K.Method);
    m.set(LspCompletionItemKind.Function, K.Function);
    m.set(LspCompletionItemKind.Constructor, K.Constructor);
    m.set(LspCompletionItemKind.Field, K.Field);
    m.set(LspCompletionItemKind.Variable, K.Variable);
    m.set(LspCompletionItemKind.Class, K.Class);
    m.set(LspCompletionItemKind.Interface, K.Interface);
    m.set(LspCompletionItemKind.Module, K.Module);
    m.set(LspCompletionItemKind.Property, K.Property);
    m.set(LspCompletionItemKind.Unit, K.Unit);
    m.set(LspCompletionItemKind.Value, K.Value);
    m.set(LspCompletionItemKind.Enum, K.Enum);
    m.set(LspCompletionItemKind.Keyword, K.Keyword);
    m.set(LspCompletionItemKind.Snippet, K.Snippet);
    m.set(LspCompletionItemKind.Color, K.Color);
    m.set(LspCompletionItemKind.File, K.File);
    m.set(LspCompletionItemKind.Reference, K.Reference);
    m.set(LspCompletionItemKind.Folder, K.Folder);
    m.set(LspCompletionItemKind.EnumMember, K.EnumMember);
    m.set(LspCompletionItemKind.Constant, K.Constant);
    m.set(LspCompletionItemKind.Struct, K.Struct);
    m.set(LspCompletionItemKind.Event, K.Event);
    m.set(LspCompletionItemKind.Operator, K.Operator);
    m.set(LspCompletionItemKind.TypeParameter, K.TypeParameter);
    return m;
}

function lspSeverityToMonaco(
    monaco: typeof Monaco,
    severity: DiagnosticSeverity | undefined,
): Monaco.MarkerSeverity {
    const S = monaco.MarkerSeverity;
    switch (severity) {
        case DiagnosticSeverity.Error:
            return S.Error;
        case DiagnosticSeverity.Warning:
            return S.Warning;
        case DiagnosticSeverity.Information:
            return S.Info;
        case DiagnosticSeverity.Hint:
            return S.Hint;
        default:
            return S.Error;
    }
}

// ---------------------------------------------------------------------------
// Provider registration (idempotent per monaco namespace)
// ---------------------------------------------------------------------------

const registered = new WeakSet<typeof Monaco>();

export function registerPowerQueryLanguageServices(monaco: typeof Monaco): void {
    if (registered.has(monaco)) return;
    registered.add(monaco);

    const kindMap = buildLspKindMap(monaco);

    monaco.languages.registerCompletionItemProvider(POWERQUERY_LANGUAGE_ID, {
        triggerCharacters: ['.', '#', '"', ' ', '('],
        provideCompletionItems: async (model, position) => {
            const analysis = getAnalysis(model);
            const result = await analysis.getAutocompleteItems(monacoPositionToLsp(position));
            if (result.kind !== PQP.ResultKind.Ok || !result.value) {
                return { suggestions: [] };
            }

            const word = model.getWordUntilPosition(position);
            const range: Monaco.IRange = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };

            const suggestions: Monaco.languages.CompletionItem[] = result.value.map((item) => ({
                label: item.label,
                kind: kindMap.get(item.kind ?? LspCompletionItemKind.Text) ??
                    monaco.languages.CompletionItemKind.Text,
                insertText: item.insertText ?? item.label,
                detail: item.detail,
                documentation: normalizeDocumentation(item.documentation),
                range,
            }));

            return { suggestions };
        },
    });

    monaco.languages.registerHoverProvider(POWERQUERY_LANGUAGE_ID, {
        provideHover: async (model, position) => {
            const analysis = getAnalysis(model);
            const result = await analysis.getHover(monacoPositionToLsp(position));
            if (result.kind !== PQP.ResultKind.Ok || !result.value) return null;

            const hover = result.value;
            const contents = Array.isArray(hover.contents) ? hover.contents : [hover.contents];
            const markdown: Monaco.IMarkdownString[] = contents.map((c) => {
                if (typeof c === 'string') return { value: c };
                if ('language' in c) {
                    return { value: '```' + c.language + '\n' + c.value + '\n```' };
                }
                return { value: c.value };
            });

            return {
                contents: markdown,
                range: hover.range
                    ? {
                          startLineNumber: hover.range.start.line + 1,
                          startColumn: hover.range.start.character + 1,
                          endLineNumber: hover.range.end.line + 1,
                          endColumn: hover.range.end.character + 1,
                      }
                    : undefined,
            };
        },
    });
}

function normalizeDocumentation(
    docs: Monaco.languages.CompletionItem['documentation'] | undefined,
): Monaco.IMarkdownString | string | undefined {
    if (docs == null) return undefined;
    if (typeof docs === 'string') return docs;
    if ('value' in docs) return { value: docs.value };
    return undefined;
}

// ---------------------------------------------------------------------------
// Per-model attach: drive document sync + debounced validation
// ---------------------------------------------------------------------------

export interface AnalysisHandle {
    dispose(): void;
}

export function attachAnalysisToModel(
    monaco: typeof Monaco,
    model: Monaco.editor.ITextModel,
): AnalysisHandle {
    registerPowerQueryLanguageServices(monaco);
    const state = getOrCreateState(model);

    const runValidate = async () => {
        const document = syncDocument(model);
        if (state.disposed || model.isDisposed()) return;
        const result = await PQLS.validate(document, analysisSettings, validationSettings);
        if (state.disposed || model.isDisposed()) return;
        if (result.kind !== PQP.ResultKind.Ok || !result.value) {
            monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
            return;
        }
        const markers: Monaco.editor.IMarkerData[] = result.value.diagnostics.map((d) => ({
            severity: lspSeverityToMonaco(monaco, d.severity),
            message: d.message,
            startLineNumber: d.range.start.line + 1,
            startColumn: d.range.start.character + 1,
            endLineNumber: d.range.end.line + 1,
            endColumn: d.range.end.character + 1,
            source: typeof d.source === 'string' ? d.source : MARKER_OWNER,
            code: typeof d.code === 'string' || typeof d.code === 'number' ? String(d.code) : undefined,
        }));
        monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
    };

    const scheduleValidate = () => {
        if (state.debounceTimer) clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(runValidate, VALIDATE_DEBOUNCE_MS);
    };

    const changeSub = model.onDidChangeContent(scheduleValidate);
    const disposeSub = model.onWillDispose(() => handle.dispose());

    // Kick off an initial validation pass after registration.
    scheduleValidate();

    const handle: AnalysisHandle = {
        dispose: () => {
            if (state.disposed) return;
            state.disposed = true;
            if (state.debounceTimer) clearTimeout(state.debounceTimer);
            changeSub.dispose();
            disposeSub.dispose();
            if (!model.isDisposed()) {
                monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
            }
        },
    };
    return handle;
}

// ---------------------------------------------------------------------------
// AST-backed dangerous-function detection (replaces regex)
// ---------------------------------------------------------------------------

/** Returns the dangerous identifier names referenced anywhere in the document.
 *  Strategy: union of AST-literal scan + substring scan.
 *  - AST scan catches identifiers even when the surrounding text has been transformed
 *    (escaped identifiers, comments stripped, etc.) and lets us extend later to dotted
 *    identifier nodes.
 *  - Substring scan covers the gap for dotted identifiers (e.g. "Web.Contents") which
 *    the parser may represent as multiple tokens. This matches the previous behavior,
 *    so it preserves the existing safety floor while the AST scan adds precision over
 *    time.
 *  Net effect: never regresses vs. the old substring-only check.
 */
export async function findDangerousFunctions(
    mCode: string,
    dangerousIdentifiers: readonly string[],
): Promise<string[]> {
    const found = new Set<string>();
    for (const id of dangerousIdentifiers) {
        if (mCode.includes(id)) found.add(id);
    }

    try {
        const document = TextDocument.create(
            'inmemory://dangerous-scan',
            POWERQUERY_LANGUAGE_ID,
            1,
            mCode,
        );
        const analysis = PQLS.AnalysisUtils.analysis(document, analysisSettings);
        const stateResult = await analysis.getParseState();
        if (stateResult.kind === PQP.ResultKind.Ok && stateResult.value) {
            const wanted = new Set(dangerousIdentifiers);
            const nodes = stateResult.value.contextState.nodeIdMapCollection.astNodeById;
            for (const node of nodes.values()) {
                const literal = (node as { literal?: unknown }).literal;
                if (typeof literal === 'string' && wanted.has(literal)) {
                    found.add(literal);
                }
            }
        }
    } catch {
        // Parser exploded; substring scan above is the safety net.
    }

    return Array.from(found);
}
