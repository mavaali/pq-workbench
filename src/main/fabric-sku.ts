/**
 * Pure SKU classification — extracted from fabric.ts so unit tests can import
 * it without dragging in the electron-tainted module graph (auth.ts pulls in
 * `electron`, which fails to load under vitest's plain Node runtime in CI).
 */

const FABRIC_SKU_PREFIXES = ['F', 'P', 'FT'];

export function isFabricCapableSku(sku: string | undefined): boolean {
  if (!sku) return false;
  const upper = sku.toUpperCase();
  if (upper.startsWith('A')) return false;
  return FABRIC_SKU_PREFIXES.some((p) => upper.startsWith(p));
}
