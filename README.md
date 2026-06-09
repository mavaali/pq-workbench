# PQ Workbench

A desktop application for authoring, testing, and executing Power Query (M code) against Microsoft Fabric workspaces — with optional AI-assisted code generation.

![Screenshot placeholder](docs/screenshot.png)

## Features

- **Power Query Editor** — Monaco-based editor with M language syntax highlighting and Ctrl+Enter execution
- **Fabric Integration** — Browse workspaces, select dataflows, and evaluate M expressions against the Fabric API
- **AI Assist** — Generate M code from natural language using GitHub Copilot CLI or Claude CLI (subprocess model — no API keys leave the machine)
- **Security-first** — Context isolation, sandbox, IPC allowlist, and a Context Preview dialog so you see exactly what's sent to an LLM before it leaves
- **Dangerous Function Warnings** — Flags `Web.Contents`, `File.Contents`, `Sql.Database`, `AdoDotNet.Query`, and `Expression.Evaluate` before execution
- **Fluent UI v9** — Native-feeling UI with light/dark theme support

## Prerequisites

- **Node.js 18+** and npm
- **Electron** (installed via npm)
- For AI Assist: `gh` CLI with Copilot extension and/or `claude` CLI

## Quick Start

```bash
git clone <repo-url> pq-workbench
cd pq-workbench
npm install
npm run dev
```

The app launches with mock data so the UI is fully functional before configuring Fabric auth.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Renderer Process (React + Fluent UI v9)        │
│  ─ No Node.js access                            │
│  ─ Communicates via window.pqWorkbench API      │
└───────────────┬─────────────────────────────────┘
                │ contextBridge (IPC allowlist)
┌───────────────▼─────────────────────────────────┐
│  Preload Script                                  │
│  ─ Exposes typed async methods                   │
│  ─ Validates channels against allowlist          │
└───────────────┬─────────────────────────────────┘
                │ ipcRenderer.invoke()
┌───────────────▼─────────────────────────────────┐
│  Main Process                                    │
│  ├── auth.ts    — MSAL public client auth        │
│  ├── fabric.ts  — Fabric REST API client         │
│  ├── llm.ts     — CLI subprocess wrapper         │
│  └── ipc.ts     — Handler registration           │
└─────────────────────────────────────────────────┘
```

### Security Model

| Setting              | Value   |
|----------------------|---------|
| `nodeIntegration`    | `false` |
| `contextIsolation`   | `true`  |
| `sandbox`            | `true`  |
| `webSecurity`        | `true`  |
| DevTools             | Dev only |

All renderer↔main communication flows through an **IPC allowlist** defined in `src/shared/channels.ts`. The preload script validates every channel before invoking it. No direct Node.js APIs are accessible from the renderer.

### LLM Integration

LLM calls use a **CLI subprocess model** — no API keys are stored or transmitted by the app. The app shells out to `gh copilot suggest` or `claude --print` with a 30-second timeout. The **Context Preview dialog** shows the user exactly what will be sent before any data leaves the machine.

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── main.ts     # Window creation & lifecycle
│   ├── ipc.ts      # IPC handler registration
│   ├── auth.ts     # MSAL authentication
│   ├── fabric.ts   # Fabric REST client
│   └── llm.ts      # LLM CLI wrapper
├── preload/        # Context bridge
│   └── preload.ts
├── renderer/       # React UI
│   ├── App.tsx
│   ├── components/ # AuthButton, QueryEditor, NLInput, ResultsPanel, etc.
│   ├── hooks/      # useFabric hook
│   └── types/      # TypeScript interfaces
└── shared/         # IPC channel constants
    └── channels.ts
```

## Scripts

| Command           | Description                          |
|--------------------|--------------------------------------|
| `npm run dev`      | Start in dev mode with hot reload    |
| `npm run build`    | Production build                     |
| `npm run start`    | Launch built app                     |
| `npm run typecheck`| Type-check without emitting          |

## Configuration

Set environment variables or update `src/main/auth.ts`:

- `PQ_WORKBENCH_CLIENT_ID` — Azure AD app registration client ID

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit changes (`git commit -m 'Add my feature'`)
4. Push and open a Pull Request

## License

[MIT](LICENSE)
