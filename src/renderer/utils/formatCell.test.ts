import { describe, it, expect } from 'vitest';
import { formatCellValue } from './formatCell';

describe('formatCellValue', () => {
  it('renders null as muted italic placeholder, left-aligned', () => {
    expect(formatCellValue(null)).toEqual({ display: 'null', align: 'left', isNull: true });
    expect(formatCellValue(undefined)).toEqual({ display: 'null', align: 'left', isNull: true });
  });

  it('renders numbers right-aligned with locale formatting', () => {
    expect(formatCellValue(1)).toEqual({ display: '1', align: 'right', isNull: false });
    expect(formatCellValue(1000)).toEqual({ display: (1000).toLocaleString(), align: 'right', isNull: false });
    expect(formatCellValue(3.14)).toMatchObject({ align: 'right' });
  });

  it('preserves Infinity / NaN as visible right-aligned tokens', () => {
    expect(formatCellValue(Infinity)).toEqual({ display: 'Infinity', align: 'right', isNull: false });
    expect(formatCellValue(NaN)).toEqual({ display: 'NaN', align: 'right', isNull: false });
  });

  it('renders strings unquoted, left-aligned', () => {
    expect(formatCellValue('Hello')).toEqual({ display: 'Hello', align: 'left', isNull: false });
    expect(formatCellValue('')).toEqual({ display: '', align: 'left', isNull: false });
  });

  it('renders booleans as Yes / No', () => {
    expect(formatCellValue(true)).toEqual({ display: 'Yes', align: 'left', isNull: false });
    expect(formatCellValue(false)).toEqual({ display: 'No', align: 'left', isNull: false });
  });

  it('renders bigints right-aligned', () => {
    expect(formatCellValue(BigInt(42))).toMatchObject({ display: (42).toLocaleString(), align: 'right' });
  });

  it('renders Date as ISO string left-aligned', () => {
    expect(formatCellValue(new Date('2026-06-12T16:00:00Z'))).toEqual({
      display: '2026-06-12T16:00:00.000Z',
      align: 'left',
      isNull: false,
    });
  });

  it('falls back to JSON for arrays and objects', () => {
    expect(formatCellValue([1, 2, 3])).toEqual({ display: '[1,2,3]', align: 'left', isNull: false });
    expect(formatCellValue({ a: 1 })).toEqual({ display: '{"a":1}', align: 'left', isNull: false });
  });
});
