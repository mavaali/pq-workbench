import type * as monaco from "monaco-editor";
import { darkNeutrals, syntax, tealBrand } from "./brand";

// Register once at startup: monaco.editor.defineTheme("pq-dark", pqMonacoDark)
// then editor.updateOptions / create with theme: "pq-dark".
// Token names below assume your M language registration tags tokens as
// keyword / identifier / string / number / comment — adjust to match your
// monarch tokenizer if the tags differ.
export const pqMonacoDark: monaco.editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: syntax.keyword.slice(1) },
    { token: "identifier.function", foreground: syntax.func.slice(1) },
    { token: "type", foreground: syntax.func.slice(1) },
    { token: "string", foreground: syntax.literal.slice(1) },
    { token: "number", foreground: syntax.literal.slice(1) },
    { token: "comment", foreground: syntax.comment.slice(1), fontStyle: "italic" },
  ],
  colors: {
    "editor.background": darkNeutrals.bgPanel,
    "editor.foreground": darkNeutrals.fgSecondary,
    "editorLineNumber.foreground": darkNeutrals.fgFaint,
    "editorLineNumber.activeForeground": darkNeutrals.fgSecondary,
    "editorCursor.foreground": tealBrand[100],
    "editor.selectionBackground": darkNeutrals.bgSelected,
    "editor.lineHighlightBackground": darkNeutrals.bgRaised,
    "editorWidget.background": darkNeutrals.bgCanvas,
    "editorWidget.border": darkNeutrals.stroke,
    "editorSuggestWidget.selectedBackground": darkNeutrals.bgSelected,
    "scrollbarSlider.background": "#2A2D3480",
    "scrollbarSlider.hoverBackground": "#2A2D34C0",
  },
};

export const pqMonacoLight: monaco.editor.IStandaloneThemeData = {
  base: "vs",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "534AB7" },
    { token: "identifier.function", foreground: "0F6E56" },
    { token: "type", foreground: "0F6E56" },
    { token: "string", foreground: "993C1D" },
    { token: "number", foreground: "993C1D" },
    { token: "comment", foreground: "6B7280", fontStyle: "italic" },
  ],
  colors: {
    "editorCursor.foreground": tealBrand[80],
  },
};
