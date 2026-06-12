// Single source of truth for the visual identity.
// Everything downstream (Fluent theme, Monaco theme, CSS vars) derives from here.

import type { BrandVariants } from "@fluentui/react-components";

// Teal ramp anchored on Fabric-adjacent #1D9E75 at stop 100.
// Verify/regenerate with the Fluent Theme Designer if you adjust the anchor:
// https://react.fluentui.dev/?path=/docs/theme-theme-designer--docs
export const tealBrand: BrandVariants = {
  10: "#020E0A",
  20: "#0A1F17",
  30: "#0C2F22",
  40: "#0D3E2D",
  50: "#0E4E38",
  60: "#0F5E44",
  70: "#106E50",
  80: "#127F5D",
  90: "#15906A",
  100: "#1D9E75",
  110: "#3DAB84",
  120: "#58B894",
  130: "#72C5A4",
  140: "#8CD2B5",
  150: "#A6DFC6",
  160: "#C1EBD8",
};

// Neutrals for the dark instrument-panel surface. Fluent's stock dark is a
// warm #292929 family; we want a cooler, deeper panel.
export const darkNeutrals = {
  bgCanvas: "#111317", // status bar, deepest chrome
  bgPanel: "#16181D", // main surfaces, editor background
  bgRaised: "#1C1F26", // hover, raised rows
  bgSelected: "#1F2937", // sidebar selection fill
  stroke: "#2A2D34", // hairline borders
  strokeSubtle: "#22252B", // grid row separators
  fgPrimary: "#E8EAED",
  fgSecondary: "#9AA0A6",
  fgMuted: "#6B7280",
  fgFaint: "#4B5563", // line numbers, type hints
} as const;

// Syntax accents (shared by Monaco theme and any inline code rendering)
export const syntax = {
  keyword: "#7F77DD",
  func: "#5DCAA5",
  literal: "#F0997B", // strings and numbers
  comment: "#5F6B7A",
} as const;

export const fonts = {
  mono: `"JetBrains Mono", "SF Mono", "Cascadia Code", Consolas, monospace`,
  sans: `"Segoe UI Variable", "Segoe UI", -apple-system, system-ui, sans-serif`,
} as const;
