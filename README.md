# mind-query

> **AI-powered natural language interface for multi-database querying over MCP**

mind-query lets you ask questions about your data in plain English or Vietnamese. It connects to PostgreSQL, MySQL, SQL Server, and MongoDB through MCP (Model Context Protocol) servers, translates your questions into the correct query language, and returns results in a clean, secure chat interface.

---

## Features

- **Natural language queries** — Ask in English or Vietnamese; the agent generates the appropriate SQL or MongoDB query
- **Multi-database support** — PostgreSQL, MySQL, SQL Server, MongoDB, plus a built-in Demo mode (no setup required)
- **3-layer security pipeline** — every request passes through a Security Gate before touching any database
- **PII masking** — `password`, `email`, `phone`, and similar fields are automatically redacted in results
- **Audit logging** — every query event (security check, execution, output filter) is appended to `logs/audit.jsonl`
- **Schema browser** — sidebar lists available tables/collections with one-click query suggestions
- **SQL/MQL viewer** — syntax-highlighted query display with copy and expand controls
- **CSV export** — download any result set with one click
- **Demo mode** — ships with a seeded in-memory SQLite database (customers, products, orders) for instant testing

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
│  Layer 2 · Data Agent     (LLM + retry x3)     │
│  Generates SQL or MongoDB query from schema    │
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
Data Agent
    │
    ├─ SqlDataAgentImpl  ──►  PostgresMcpExecutor  ──►  postgres-mcp  ──►  PostgreSQL
    │                    ──►  MySqlMcpExecutor     ──►  mysql-mcp     ──►  MySQL
    │                    ──►  SqlServerMcpExecutor ──►  sql-server-mcp──►  SQL Server
    │
    └─ MongoDataAgentImpl──►  MongoDbMcpExecutor   ──►  mongodb-mcp   ──►  MongoDB
```

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
│   │   │   ├── IOutputFilter.ts
│   │   │   └── IAuditLogger.ts
│   │   └── use-cases/
│   │       ├── ValidateSecurityUseCase.ts
│   │       ├── ExecuteQueryUseCase.ts
│   │       └── FilterOutputUseCase.ts
│   │
│   ├── infrastructure/                # Implementations — depend on core interfaces
│   │   ├── llm/ClaudeClient.ts
│   │   ├── mcp/
│   │   │   ├── IMcpClient.ts
│   │   │   └── McpClient.ts           # SSE transport wrapper for MCP SDK
│   │   ├── security/SecurityGateImpl.ts
│   │   ├── agent/
│   │   │   ├── SqlDataAgentImpl.ts    # Generates SQL (Postgres / MySQL / SQL Server)
│   │   │   └── MongoDataAgentImpl.ts  # Generates MongoDB MQL JSON
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
│   │   │   ├── sqlDataAgentPrompt.ts  # Dialect-aware SQL generation
│   │   │   └── mongoDataAgentPrompt.ts# MQL / aggregation pipeline generation
│   │   └── pipeline/QueryPipeline.ts  # Chains all 3 layers
│   │
│   ├── lib/container.ts               # DI factory — creates pipeline per request
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
│   │   └── SecurityBadge.tsx          # Risk score indicator
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
├── logs/                              # Created at runtime
│   └── audit.jsonl                    # Append-only audit log (JSONL)
├── .env.example
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
| Anthropic API key | Required |
| MCP servers | Optional (Demo mode works without them) |

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/az-coder-123/mind-query.git
cd mind-query
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and set your Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run in development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app starts in **Demo mode** automatically — no MCP server setup needed.

---

## MCP Server Setup

To connect a real database, start the corresponding MCP server and add its URL to `.env.local`.

### PostgreSQL

```bash
# Clone and start the MCP server
git clone https://github.com/az-coder-123/postgres-mcp
cd postgres-mcp && npm install && npm start
```

```env
POSTGRES_MCP_URL=http://localhost:3101
```

### MySQL

```bash
git clone https://github.com/az-coder-123/mysql-mcp
cd mysql-mcp && npm install && npm start
```

```env
MYSQL_MCP_URL=http://localhost:3102
```

### SQL Server

```bash
git clone https://github.com/az-coder-123/sql-server-mcp
cd sql-server-mcp && npm install && npm start
```

```env
SQLSERVER_MCP_URL=http://localhost:3103
SQLSERVER_SCHEMA=dbo          # optional, defaults to dbo
```

### MongoDB

```bash
git clone https://github.com/az-coder-123/mongodb-mcp
cd mongodb-mcp && npm install && npm start
```

```env
MONGODB_MCP_URL=http://localhost:3104
MONGODB_DATABASE=mydb         # the database name to query
```

After adding URLs, restart `npm run dev`. The database tabs appear automatically in the header.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | — | Your Anthropic API key |
| `POSTGRES_MCP_URL` | No | — | PostgreSQL MCP server URL |
| `MYSQL_MCP_URL` | No | — | MySQL MCP server URL |
| `SQLSERVER_MCP_URL` | No | — | SQL Server MCP server URL |
| `SQLSERVER_SCHEMA` | No | `dbo` | Default schema for SQL Server |
| `MONGODB_MCP_URL` | No | — | MongoDB MCP server URL |
| `MONGODB_DATABASE` | No | `mydb` | MongoDB database name |

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
  "query": "SELECT c.name, SUM(o.total_price) AS revenue ...",
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

Returns the list of database types currently configured (with a valid MCP URL).

**Response:**
```json
{
  "available": ["demo", "postgres"]
}
```

---

## Security Model

### Threat layers defended

| Threat | Defense |
|---|---|
| Destructive SQL (`DROP`, `DELETE`, `UPDATE`, …) | Security Gate blocks before any DB call |
| Prompt injection ("ignore previous instructions") | Gate uses isolated LLM call; user input never embedded in system prompt |
| Data exfiltration (`UNION SELECT`) | Gate + Data Agent enforces SELECT-only via regex before execution |
| PII leakage | Output Filter masks sensitive column names at the field level |
| Hallucinated data | Agent retries on error; never fabricates — reports "no data found" |

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

2. **Register it** in `src/lib/container.ts` — add a case in `createExecutor()` and a row in `DB_CONFIG`.

3. **Add metadata** in `src/components/DbSelector.tsx` — icon, label, color.

No changes needed in the pipeline, security gate, or UI logic.

---

### Add a new security rule

Edit `src/application/prompts/securityGatePrompt.ts`. Add your pattern to the appropriate tier section. The gate's behavior updates on next request — no code changes required.

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
