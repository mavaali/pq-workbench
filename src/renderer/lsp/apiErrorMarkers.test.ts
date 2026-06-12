import { describe, it, expect } from 'vitest';
import { parseApiErrorPosition } from './apiErrorMarkers';

describe('parseApiErrorPosition', () => {
  it('parses the canonical Fabric SyntaxError range form', () => {
    expect(parseApiErrorPosition('SyntaxError[(1,54)-(1,55)]')).toEqual({
      startLine: 1,
      startColumn: 54,
      endLine: 1,
      endColumn: 55,
    });
  });

  it('parses a multi-line range', () => {
    expect(
      parseApiErrorPosition('Microsoft.Mashup.Engine.Parser.SyntaxError at (3,12)-(4,8): unexpected token')
    ).toEqual({ startLine: 3, startColumn: 12, endLine: 4, endColumn: 8 });
  });

  it('handles whitespace inside parens', () => {
    expect(parseApiErrorPosition('error at ( 2 , 7 ) - ( 2 , 10 )')).toEqual({
      startLine: 2,
      startColumn: 7,
      endLine: 2,
      endColumn: 10,
    });
  });

  it('falls back to a single position with synthesised 1-char span', () => {
    expect(parseApiErrorPosition('Token Eof expected at (5,9)')).toEqual({
      startLine: 5,
      startColumn: 9,
      endLine: 5,
      endColumn: 10,
    });
  });

  it('returns null for messages without any position info', () => {
    expect(parseApiErrorPosition('Internal server error')).toBeNull();
    expect(parseApiErrorPosition('403 Forbidden')).toBeNull();
  });

  it('returns null for null/undefined/empty', () => {
    expect(parseApiErrorPosition(null)).toBeNull();
    expect(parseApiErrorPosition(undefined)).toBeNull();
    expect(parseApiErrorPosition('')).toBeNull();
  });

  it('prefers the first range match (most messages put the error position first)', () => {
    const msg = 'SyntaxError[(1,2)-(1,3)] (later mention of (9,9)-(9,10) should be ignored)';
    expect(parseApiErrorPosition(msg)).toEqual({
      startLine: 1,
      startColumn: 2,
      endLine: 1,
      endColumn: 3,
    });
  });
});
