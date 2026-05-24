# Mind Query

> **AI-powered natural language to SQL/MQL query engine** — ask in English, get instant results from PostgreSQL, MySQL, SQL Server, and MongoDB via MCP.

---

## Features

- **Natural language queries** — Ask in plain English; the agent generates the appropriate SQL or MongoDB query
- **Multi-database support** — PostgreSQL, MySQL, SQL Server, MongoDB, plus a built-in Demo mode (no setup required)
- **Native MCP tool calling** — The LLM receives all database tools directly and calls them in an agentic loop, exactly like Cline
- **3-layer security pipeline** — every request passes through a Security Gate before touching any database
- **PII masking** — `password`, `email`, `phone`, and similar fields are automatically redacted in results
- **Audit logging** — every query event (security check, execution, output filter) is appended to `logs/audit.jsonl`
- **Schema browser** — sidebar lists available tables/collections with one-click query suggestions
- **SQL/MQL viewer** — syntax-highlighted query display with copy and expand controls
- **CSV export** — download any result set with one click
- **Demo mode** — ships with a seeded in-memory SQLite database (customers, products, orders) for instant testing
- **Settings UI** — configure LLM provider and all MCP servers directly from the browser; no environment files needed

---

## Architecture

```
User Prompt
     │
     ▼
┌────────────────────────────────────────────────┐
│  Layer 1 · Security Gate  (isolated LLM call)  │
│  Classifies prompt — blocks if risk > 40       │
└───────────────────┬────────────────────────────┘
                    │ isSafe = true
                    ▼
┌────────────────────────────────────────────────┐
│  Layer 2 · ToolCallingDataAgent  (agentic loop)│
│  LLM receives MCP tools → calls them directly  │
│  Iterates up to 8 rounds until data retrieved  │
└───────────────────┬────────────────────────────┘
                    │ raw rows
                    ▼
┌────────────────────────────────────────────────┐
│  Layer 3 · Output Filter  (rule-based)         │
│  Masks PII fields before returning to UI       │
└───────────────────┬────────────────────────────┘
                    │ clean result
                    ▼
                Response + Audit Log
```

**MCP layer — each database is an independent MCP server:**

```
ToolCallingDataAgent
    │
    ├─ McpClient (shared)  ──►  postgres-mcp  ──►  PostgreSQL
    │                      ──►  mysql-mcp     ──►  MySQL
    │                      ──►  sql-server-mcp──►  SQL Server
    └─                     ──►  mongodb-mcp   ──►  MongoDB
```

The `ToolCallingDataAgent` calls `listTools()` on the MCP client at the start of each request, passes all tool schemas to the LLM via the function-calling API, then executes the tools the LLM requests in a loop — no prompt templates or query generation required.

**SOLID principles applied throughout:**

| Principle | How |
|---|---|
| **S** — Single Responsibility | Each class does exactly one thing (gate, agent, filter, executor, logger) |
| **O** — Open/Closed | Add a new database type by adding a new executor class — zero changes to the pipeline |
| **L** — Liskov Substitution | Any `IQueryExecutor` implementation is interchangeable in the pipeline |
| **I** — Interface Segregation | `IQueryExecutor`, `ISecurityGate`, `IDataAgent`, `IOutputFilter`, `IAuditLogger` are small and focused |
| **D** — Dependency Inversion | `QueryPipeline` depends on interfaces, not concrete classes; injected by `container.ts` |

---

## Project Structure

```
mind-query/
├── src/
│   ├── core/                          # Domain layer — no external dependencies
│   │   ├── entities/
│   │   │   ├── SecurityReport.ts
│   │   │   └── QueryResult.ts
│   │   ├── interfaces/
│   │   │   ├── IQueryExecutor.ts      # Contract for all DB executors
│   │   │   ├── ISecurityGate.ts
│   │   │   ├── IDataAgent.ts
│   │   │   ├── ILLMClient.ts          # Includes completeWithTools() for native tool calling
│   │   │   ├── IOutputFilter.ts
│   │   │   └── IAuditLogger.ts
│   │   └── use-cases/
│   │       ├── ValidateSecurityUseCase.ts
│   │       ├── ExecuteQueryUseCase.ts
│   │       └── FilterOutputUseCase.ts
│   │
│   ├── infrastructure/                # Implementations — depend on core interfaces
│   │   ├── llm/
│   │   │   ├── ClaudeClient.ts        # Anthropic Claude (claude-sonnet-4-6)
│   │   │   └── OpenAICompatibleClient.ts # OpenAI-compatible APIs (Z AI, OpenRouter, etc.)
│   │   ├── mcp/
│   │   │   ├── IMcpClient.ts          # listTools() + callTool() contract
│   │   │   └── McpClient.ts           # SSE and stdio transport; envOverrides support
│   │   ├── security/SecurityGateImpl.ts
│   │   ├── agent/
│   │   │   ├── ToolCallingDataAgent.ts# Native MCP tool calling loop (all real DBs)
│   │   │   └── SqlDataAgentImpl.ts    # Text-based SQL generation (Demo mode only)
│   │   ├── filters/OutputFilterImpl.ts
│   │   ├── audit/FileAuditLogger.ts
│   │   └── database/
│   │       ├── DemoExecutor.ts        # In-memory SQLite, no MCP required
│   │       ├── PostgresMcpExecutor.ts
│   │       ├── MySqlMcpExecutor.ts
│   │       ├── SqlServerMcpExecutor.ts
│   │       └── MongoDbMcpExecutor.ts
│   │
│   ├── application/                   # Orchestration layer
│   │   ├── prompts/
│   │   │   ├── securityGatePrompt.ts  # Threat taxonomy + calibration examples
│   │   │   └── sqlDataAgentPrompt.ts  # Dialect-aware SQL generation (Demo mode)
│   │   └── pipeline/QueryPipeline.ts  # Chains all 3 layers
│   │
│   ├── lib/
│   │   ├── container.ts               # DI factory — creates pipeline per request
│   │   └── settings.ts                # Read/write mcp-settings.json
│   ├── types/api.ts                   # Shared request/response types
│   │
│   ├── components/                    # React UI components
│   │   ├── ChatInterface.tsx          # Main shell — state, layout, routing
│   │   ├── Header.tsx                 # Logo + DB selector + controls
│   │   ├── DbSelector.tsx             # Database tab switcher
│   │   ├── SchemaSidebar.tsx          # Table/collection browser
│   │   ├── MessageBubble.tsx          # User / assistant / error messages
│   │   ├── ResultTable.tsx            # Paginated data grid with CSV export
│   │   ├── SqlBlock.tsx               # Syntax-highlighted SQL/MQL viewer
│   │   ├── SecurityBadge.tsx          # Risk score indicator
│   │   └── SettingsModal.tsx          # LLM + MCP server configuration UI
│   │
│   └── app/                           # Next.js App Router
│       ├── layout.tsx
│       ├── page.tsx
│       ├── globals.css
│       └── api/
│           ├── query/route.ts         # POST /api/query
│           ├── schema/route.ts        # GET  /api/schema?dbType=
│           └── health/route.ts        # GET  /api/health
│
├── docs/
│   └── USER_GUIDE.md
├── logs/                              # Created at runtime
│   └── audit.jsonl                    # Append-only audit log (JSONL)
├── mcp-settings.json                  # Local config (git-ignored); see mcp-settings.example.json
├── mcp-settings.example.json          # Template — copy and fill in your values
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| npm | 9+ |
| LLM API key | Required (Anthropic or any OpenAI-compatible provider) |
| MCP servers | Optional — Demo mode works without them |

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/az-coder-123/mind-query.git
cd mind-query
npm install
```

### 2. Run in development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app starts in **Demo mode** — no configuration or MCP server needed.

### 3. Configure your LLM provider

Click the **⚙ Settings** button (top-right of the header), then open the **LLM Provider** section:

| Field | Description |
|---|---|
| Provider | `anthropic` or `openai` |
| API Key | Your Anthropic key (`sk-ant-...`) or OpenAI-compatible key |
| Base URL | Required for OpenAI-compatible providers (e.g. `https://api.z.ai/api/paas/v4`) |
| Model | Required for OpenAI-compatible providers (e.g. `GLM-5.1`) |

Click **Save**. Settings are written to `mcp-settings.json` (git-ignored) and take effect on the next request.

---

## MCP Server Setup

Real database connections are configured in **Settings** — no environment variables needed.

### Supported transport modes

| Mode | When to use | Settings fields needed |
|---|---|---|
| **stdio** (recommended) | MCP server is on the same machine | Exec Path + Start Command |
| **SSE** | MCP server runs separately (Docker, remote host) | URL |

### Steps

1. Clone and install your MCP server:
   ```bash
   git clone https://github.com/az-coder-123/mongodb-mcp
   cd mongodb-mcp && npm install
   ```

2. Open **Settings → MongoDB** in the mind-query UI.

3. Fill in the fields:

   | Field | stdio mode | SSE mode |
   |---|---|---|
   | **Enabled** | ✓ | ✓ |
   | **URL** | *(leave blank)* | `http://localhost:3100` |
   | **Exec Path** | `/path/to/mongodb-mcp` | *(leave blank)* |
   | **Start Command** | `npm start` | *(leave blank)* |
   | **Conn URI** | `mongodb://localhost:27017` | *(set in MCP server's env)* |
   | **Database** | `mydb` | `mydb` |

4. Click **Save**. The MongoDB tab appears in the header immediately.

The same process applies to PostgreSQL, MySQL, and SQL Server — each has its own section in Settings.

### SQL Server — schema field

SQL Server also has a **Schema** field (default: `dbo`). Set it to the schema name you want the agent to use.

---

## LLM Provider Reference

### Anthropic (default)

```
Provider : anthropic
API Key  : sk-ant-...
Base URL : (leave blank)
Model    : (leave blank)
```

Uses `claude-sonnet-4-6` for both the Security Gate and the Data Agent.

### OpenAI-compatible providers

Any provider that implements the OpenAI Chat Completions API works:

| Provider | Base URL | Model |
|---|---|---|
| **Z AI** | `https://api.z.ai/api/paas/v4` | `GLM-5.1` |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `openai/gpt-4o` |
| **Together AI** | `https://api.together.xyz/v1` | `meta-llama/Llama-3-70b-chat` |
| **Local (Ollama)** | `http://localhost:11434/v1` | `llama3` |

---

## API Reference

### `POST /api/query`

Execute a natural language query against the selected database.

**Request body:**
```json
{
  "prompt": "Show me the top 10 customers by total order value",
  "dbType": "postgres"
}
```

**`dbType` values:** `demo` · `postgres` · `mysql` · `sqlserver` · `mongodb`

**Success response (`200`):**
```json
{
  "success": true,
  "securityReport": { "isSafe": true, "riskScore": 5, "detectedPatterns": [] },
  "query": "{\"tool\": \"query\", \"arguments\": {\"sql\": \"SELECT ...\"}}",
  "dialect": "PostgreSQL",
  "data": [{ "name": "Alice", "revenue": 99000000 }],
  "rowCount": 10,
  "maskedFields": [],
  "executionTimeMs": 312,
  "tablesAccessed": ["customers", "orders"]
}
```

**Blocked response (`403`):**
```json
{
  "success": false,
  "blocked": true,
  "riskScore": 95,
  "detectedPatterns": ["DROP", "destructive_sql"],
  "error": "[BLOCKED] Risk score: 95/100. Destructive SQL detected."
}
```

---

### `GET /api/schema?dbType=postgres`

Returns the list of tables (or collections) for the given database.

**Response:**
```json
{
  "tables": ["customers", "orders", "products"],
  "dialect": "PostgreSQL",
  "displayName": "PostgreSQL"
}
```

---

### `GET /api/health`

Returns the list of database types currently configured and enabled.

**Response:**
```json
{
  "available": ["demo", "postgres", "mongodb"]
}
```

---

## Security Model

### Threat layers defended

| Threat | Defense |
|---|---|
| Destructive SQL (`DROP`, `DELETE`, `UPDATE`, …) | Security Gate blocks before any DB call |
| Prompt injection ("ignore previous instructions") | Gate uses isolated LLM call; user input never embedded in system prompt |
| Data exfiltration (`UNION SELECT`) | Gate + executors enforce read-only operations |
| PII leakage | Output Filter masks sensitive column names at the field level |
| Hallucinated data | ToolCallingDataAgent only returns data retrieved via real MCP tool calls |

### Audit trail

Every request produces three log entries in `logs/audit.jsonl`:

```jsonl
{"type":"SECURITY_CHECK","timestamp":"...","prompt":"...","securityReport":{...}}
{"type":"QUERY_EXECUTED","timestamp":"...","queryResult":{...}}
{"type":"OUTPUT_FILTERED","timestamp":"..."}
```

---

## Extending the System

### Add a new database type

1. **Create an executor** in `src/infrastructure/database/` implementing `IQueryExecutor`:
   ```typescript
   export class NewDbMcpExecutor implements IQueryExecutor {
     getDialect()     { return 'NewDB' }
     getDisplayName() { return 'New Database' }
     async listTables()               { /* call MCP tool */ }
     async getSchema(table: string)   { /* call MCP tool */ }
     async executeQuery(query: string){ /* call MCP tool */ }
   }
   ```

2. **Register it** in `src/lib/container.ts` — add a case in `createPipeline()` and a row in `DB_CONFIG`.

3. **Add the MCP client build** in `buildMcpClient()` with the appropriate URI env key.

No changes needed in the pipeline, security gate, or UI logic.

---

### Add a new security rule

Edit `src/application/prompts/securityGatePrompt.ts`. Add your pattern to the appropriate tier section. The gate's behaviour updates on next request — no code changes required.

---

## Development

```bash
npm run dev     # Start development server (http://localhost:3000)
npm run build   # Production build with type-checking
npm run start   # Start production server
```

Audit logs are written to `logs/audit.jsonl` (created automatically).

---

## License

MIT
