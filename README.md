# PQ Workbench

A lightweight desktop app for running Power Query (M code) against Microsoft Fabric — without opening the portal.

Write M code, or describe what you want in plain English and let AI generate it. Pick a workspace, pick a dataflow, hit Run, see results.

## What it does

| Capability | How |
|---|---|
| **Execute M code** | Calls the Fabric Dataflow `executeQuery` API, parses Apache Arrow responses |
| **Browse queries** | Reads the dataflow definition, lists named queries in a sidebar — click to load |
| **AI Assist** | GitHub Copilot CLI **or** Claude CLI generates M from natural language. Context Preview shows exactly what's sent. |
| **Browse Fabric** | Searchable workspace + dataflow pickers, alphabetically sorted |
| **Inspect results** | Sortable data grid, schema tab (column names/types), query info tab |

## Quick Start

### Prerequisites

- **Node.js 18+** ([download](https://nodejs.org))
- **Git** (to clone)
- A **Microsoft Fabric** workspace with at least one dataflow
- *(Optional, for AI Assist)* either:
  - [GitHub Copilot CLI](https://gh.io/copilot-cli), or
  - [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli)

### Install and run

**Option 1: Download a release** (no dev tools needed)

Go to [Releases](https://github.com/mavaali/pq-workbench/releases/latest) and download:
- **macOS:** `.dmg` (signed + notarized)
- **Windows:** `.exe` (portable or installer)
- **Linux:** `.AppImage`

**Option 2: Build from source**

```bash
git clone https://github.com/mavaali/pq-workbench.git
cd pq-workbench
npm install
npm run dev
```

The app opens. Click **Sign In** — your browser opens for Microsoft login. After auth, your workspaces appear in the dropdown.

### Build a distributable

```bash
# macOS
npm run dist:mac

# Windows
npm run dist:win

# Linux
npm run dist:linux
```

Outputs land in `release/`.

## Usage Scenarios

### 1. Quick M code test

You have an M expression and want to see what it returns against live Fabric data.

1. Sign in → pick workspace → pick dataflow
2. Type or paste M code in the editor
3. Press **Ctrl+Enter** (or click Run)
4. Results appear in the Data tab. Check Schema tab for column types.

### 2. Ask a question in plain English

You need data but don't know M syntax.

1. Toggle **AI Assist** in the toolbar
2. Choose your provider (Copilot CLI or Claude CLI)
3. Type: *"Show top 10 customers by revenue from the Sales table"*
4. Click **Generate M** → review the Context Preview → click **Approve & Send**
5. The CLI generates M code → it appears in the editor
6. Review/tweak the M → click Run

### 3. Debug an existing dataflow query

A production dataflow is returning unexpected results. You want to test individual query steps.

1. Sign in → select the workspace → select the dataflow
2. The **query browser sidebar** shows all named queries from the dataflow
3. Click a query to load its M into the editor
4. Edit and re-run to isolate the issue

> **Note:** The query browser requires **Contributor** role on the workspace. Viewers see "(need contributor access)."

### 4. Explore a new data source

You want to see what's in a Fabric Lakehouse table before building a full dataflow.

1. Create or select a scratch dataflow
2. Write an M expression connecting to your data source
3. Run it — inspect schema and sample rows
4. Iterate until you have the right shape, then move the M to your production dataflow

## Safety

PQ Workbench is designed to run arbitrary M code against your production Fabric workspaces. That's a sharp tool, so the safety story leads:

- **Context Preview** — every AI Assist call shows you the exact prompt + context before it leaves your machine. No "trust the LLM" black box.
- **Dangerous function linter** — warns before executing M that uses `Web.Contents`, `File.Contents`, `Sql.Database`, `AdoDotNet.Query`, `Expression.Evaluate`, or other shell-equivalent calls.
- **No secrets stored locally** — auth tokens stay in the OS keychain via MSAL; LLM credentials stay with the CLI tools (`gh auth`, `claude login`).
- **Electron hardening** — `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`. The renderer can't reach Node APIs directly.
- **IPC allowlist** — every renderer↔main channel is explicitly enumerated; unknown channels are rejected at the preload layer.
- **Connection binding is explicit** — the app refuses to run a query when the dataflow's bound connections don't actually have credentials for the data sources in the M code; it surfaces a picker with authenticated alternatives instead of silently failing.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Electron App                                │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ Renderer     │  │ Main Process         │  │
│  │ (React 18 +  │  │                      │  │
│  │  Fluent v9)  │  │ MSAL (PBI Desktop    │  │
│  │              │  │  client ID, PKCE)    │  │
│  │ Monaco Editor│  │                      │  │
│  │ Results Grid │  │ Fabric REST API      │  │
│  │ Query Browser│  │ (executeQuery,       │  │
│  │ AI Assist    │  │  getDefinition)      │  │
│  └─────────────┘  │                      │  │
│                    │ Copilot CLI /        │  │
│                    │ Claude CLI           │  │
│                    │ (subprocess)         │  │
│                    └──────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Key technical decisions

| Decision | Choice | Why |
|---|---|---|
| Auth | MSAL PKCE with PBI Desktop client ID | Pre-authorized in all MSFT tenants, no app registration needed |
| API scopes | `analysis.windows.net/powerbi/api/.default` | Fabric API accepts PBI tokens for executeQuery |
| Response format | Apache Arrow IPC | Parsed client-side with `apache-arrow` |
| M code format | Auto-wrapped as section document | `executeQuery` requires `section Section1; shared name = <expr>;` |
| LLM integration | CLI subprocess (`copilot -p` or `claude -p`) | Zero infra, user owns auth + cost, pluggable backend |
| Editor | Monaco | M syntax highlighting, shared codebase with VS Code |


## Tech Stack

- **Electron** — desktop runtime
- **React 18** + **TypeScript** — UI
- **Fluent UI v9** — design system
- **Monaco Editor** — M code editing
- **MSAL Node** — Azure AD authentication
- **Apache Arrow** — result parsing
- **Allotment** — resizable split panels
- **GitHub Copilot CLI** or **Claude CLI** — NL → M generation (pluggable)

## Contributing

This is an early prototype. Issues and PRs welcome.

```bash
npm run dev          # Start dev mode (hot reload)
npm run build        # Production build
npm run typecheck    # Type check without emitting
```

## License

MIT

