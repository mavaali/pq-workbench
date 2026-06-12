import { createRoot } from 'react-dom/client';
import { loader } from '@monaco-editor/react';
import { App } from './App';

// Bundle JetBrains Mono so the editor + tab labels + grid render consistently
// on macOS / Windows / Linux. ~95KB woff2, weights 400 and 500.
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

// Chrome identity layer (Fable theme spec PR-B). Resolves Fluent v9's CSS
// custom properties for places Fluent components don't reach: sidebar
// selection accent, results grid typography, etc.
import './theme/chrome.css';

// Configure Monaco to load from node_modules instead of CDN
// This avoids CSP issues in Electron
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs',
  },
});

// Disable Monaco web workers to avoid blob: CSP issues in Electron
(window as any).MonacoEnvironment = {
  getWorker: () => {
    return new Proxy({} as Worker, {
      get: (_target, prop) => {
        if (prop === 'onmessage' || prop === 'postMessage' || prop === 'terminate') {
          return () => {};
        }
        return undefined;
      },
      set: () => true,
    });
  },
};

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');
const root = createRoot(container);
root.render(<App />);
