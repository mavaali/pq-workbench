import {
  createDarkTheme,
  createLightTheme,
  type Theme,
} from "@fluentui/react-components";
import { tealBrand, darkNeutrals, fonts } from "./brand";

// Dark is the product identity; light is the courtesy mode.
// createDarkTheme handles all brand-token mapping (colorBrandBackground,
// hover/pressed states, focus rings) from the ramp. We then override the
// neutral family to get the deep cool panel instead of Fluent's warm gray.
const base = createDarkTheme(tealBrand);

export const pqDarkTheme: Theme = {
  ...base,

  // Surfaces
  colorNeutralBackground1: darkNeutrals.bgPanel,
  colorNeutralBackground1Hover: darkNeutrals.bgRaised,
  colorNeutralBackground1Pressed: darkNeutrals.bgSelected,
  colorNeutralBackground2: darkNeutrals.bgCanvas,
  colorNeutralBackground3: darkNeutrals.bgCanvas,
  colorNeutralBackgroundStatic: darkNeutrals.bgPanel,
  colorSubtleBackgroundHover: darkNeutrals.bgRaised,
  colorSubtleBackgroundPressed: darkNeutrals.bgSelected,

  // Strokes
  colorNeutralStroke1: darkNeutrals.stroke,
  colorNeutralStroke2: darkNeutrals.stroke,
  colorNeutralStroke3: darkNeutrals.strokeSubtle,
  colorNeutralStrokeSubtle: darkNeutrals.strokeSubtle,

  // Text
  colorNeutralForeground1: darkNeutrals.fgPrimary,
  colorNeutralForeground2: darkNeutrals.fgSecondary,
  colorNeutralForeground3: darkNeutrals.fgMuted,
  colorNeutralForeground4: darkNeutrals.fgFaint,

  // On-brand text: dark teal on the teal Run button, per the ramp
  colorNeutralForegroundOnBrand: tealBrand[20],

  fontFamilyBase: fonts.sans,
  fontFamilyMonospace: fonts.mono,
};

// Light mode: stock light neutrals are fine; only the brand ramp changes.
// Don't hand-tune light neutrals until dark is settled.
export const pqLightTheme: Theme = {
  ...createLightTheme(tealBrand),
  fontFamilyBase: fonts.sans,
  fontFamilyMonospace: fonts.mono,
};
