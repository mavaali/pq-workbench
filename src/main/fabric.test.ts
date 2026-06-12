import { describe, it, expect } from 'vitest';
import { isFabricCapableSku } from './fabric';

describe('isFabricCapableSku', () => {
  it.each([
    ['F2', true],
    ['F64', true],
    ['F2048', true],
    ['P1', true],
    ['P3', true],
    ['FT1', true],
    ['FT2', true],
  ])('returns true for Fabric-eligible SKU %s', (sku, expected) => {
    expect(isFabricCapableSku(sku)).toBe(expected);
  });

  it.each([
    ['A1', false],
    ['A4', false],
    ['EM1', false],
    ['', false],
  ])('returns false for non-Fabric SKU %s', (sku, expected) => {
    expect(isFabricCapableSku(sku)).toBe(expected);
  });

  it('returns false for undefined', () => {
    expect(isFabricCapableSku(undefined)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isFabricCapableSku('f2')).toBe(true);
    expect(isFabricCapableSku('p1')).toBe(true);
    expect(isFabricCapableSku('ft1')).toBe(true);
    expect(isFabricCapableSku('a1')).toBe(false);
  });
});
