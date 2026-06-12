/**
 * Format a single cell value for the Data tab grid.
 *
 * Fable design review (#56): the grid was rendering bare numbers but
 * quoted strings, mixing data-view and M-literal-view. This module
 * standardises on data-view (strings left-aligned, unquoted; numbers
 * right-aligned, locale-formatted; booleans as Yes/No; nulls muted
 * italic) — the Schema tab already owns type display.
 *
 * Arrow's vec.get(i) returns the underlying JS value for primitives;
 * structs/lists arrive as objects/arrays which we JSON.stringify because
 * there's no better single-line representation.
 */

export type CellAlign = 'left' | 'right' | 'center';

export interface FormattedCell {
  display: string;
  align: CellAlign;
  isNull: boolean;
}

const NULL_CELL: FormattedCell = { display: 'null', align: 'left', isNull: true };

export function formatCellValue(value: unknown): FormattedCell {
  if (value == null) return NULL_CELL;

  if (typeof value === 'boolean') {
    return { display: value ? 'Yes' : 'No', align: 'left', isNull: false };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { display: String(value), align: 'right', isNull: false };
    }
    return { display: value.toLocaleString(), align: 'right', isNull: false };
  }

  if (typeof value === 'bigint') {
    return { display: value.toLocaleString(), align: 'right', isNull: false };
  }

  if (value instanceof Date) {
    return { display: value.toISOString(), align: 'left', isNull: false };
  }

  if (typeof value === 'string') {
    return { display: value, align: 'left', isNull: false };
  }

  // Arrow structs / lists / maps → compact JSON. Lossy but at least
  // self-describing rather than "[object Object]".
  try {
    return { display: JSON.stringify(value), align: 'left', isNull: false };
  } catch {
    return { display: String(value), align: 'left', isNull: false };
  }
}
