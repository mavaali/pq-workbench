/**
 * Map server-side parse errors from executeQuery onto the Monaco editor.
 *
 * Fabric's executeQuery API returns errors that embed a position range,
 * e.g. `SyntaxError[(1,54)-(1,55)]` or `... at (3,12)-(3,18)`. We extract
 * the range and surface it as a Monaco marker so the editor highlights the
 * offending span instead of the user having to read a stack trace.
 *
 * Local parse errors are handled separately by the LSP `validate` path in
 * powerquery.ts under MARKER_OWNER='powerquery-lsp'. We use a distinct
 * MARKER_OWNER here so the two channels don't clobber each other.
 */

import type * as Monaco from 'monaco-editor';

export const EXECUTE_QUERY_MARKER_OWNER = 'powerquery-execute';

export interface ParsedErrorPosition {
  /** 1-based line number (Monaco convention). */
  startLine: number;
  /** 1-based column number (Monaco convention). */
  startColumn: number;
  /** 1-based line number; equals startLine when only a single position is in the message. */
  endLine: number;
  /** 1-based column number; equals startColumn + 1 when only a single position is in the message. */
  endColumn: number;
}

const RANGE_RE = /\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*-\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/;
const SINGLE_RE = /\(\s*(\d+)\s*,\s*(\d+)\s*\)/;

/**
 * Extract a 1-based line/column range from an error message, or null if none found.
 *
 * Handles both:
 *   - `SyntaxError[(1,54)-(1,55)]` — range form
 *   - `... at (3,12)` — single position (synthesises a 1-char span)
 */
export function parseApiErrorPosition(message: string | null | undefined): ParsedErrorPosition | null {
  if (!message) return null;

  const range = RANGE_RE.exec(message);
  if (range) {
    const [, sl, sc, el, ec] = range;
    return {
      startLine: Number(sl),
      startColumn: Number(sc),
      endLine: Number(el),
      endColumn: Number(ec),
    };
  }

  const single = SINGLE_RE.exec(message);
  if (single) {
    const [, sl, sc] = single;
    const line = Number(sl);
    const col = Number(sc);
    return {
      startLine: line,
      startColumn: col,
      endLine: line,
      endColumn: col + 1,
    };
  }

  return null;
}

/**
 * Apply an executeQuery error as a Monaco marker on the model. Returns true if
 * a position was parsed and a marker was set, false otherwise (caller can fall
 * back to the MessageBar-only display).
 */
export function applyExecuteQueryErrorMarker(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  message: string
): boolean {
  const pos = parseApiErrorPosition(message);
  if (!pos) {
    clearExecuteQueryErrorMarkers(monaco, model);
    return false;
  }

  const marker: Monaco.editor.IMarkerData = {
    severity: monaco.MarkerSeverity.Error,
    message,
    startLineNumber: pos.startLine,
    startColumn: pos.startColumn,
    endLineNumber: pos.endLine,
    endColumn: pos.endColumn,
    source: EXECUTE_QUERY_MARKER_OWNER,
  };

  monaco.editor.setModelMarkers(model, EXECUTE_QUERY_MARKER_OWNER, [marker]);
  return true;
}

export function clearExecuteQueryErrorMarkers(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel
): void {
  monaco.editor.setModelMarkers(model, EXECUTE_QUERY_MARKER_OWNER, []);
}
