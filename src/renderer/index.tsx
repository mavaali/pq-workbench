import { createRoot } from 'react-dom/client';
import { loader } from '@monaco-editor/react';
import { App } from './App';

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
