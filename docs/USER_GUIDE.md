# mind-query — User Guide

This guide covers everything you need to start querying your databases with natural language.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [The Interface](#the-interface)
3. [Asking Questions](#asking-questions)
4. [Switching Databases](#switching-databases)
5. [Reading Results](#reading-results)
6. [Security Indicators](#security-indicators)
7. [Schema Browser](#schema-browser)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Query Tips & Examples](#query-tips--examples)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)

---

## Getting Started

### What you need

- A running instance of mind-query (see [README.md](../README.md) for setup)
- An Anthropic API key configured in `.env.local`
- Optionally: one or more MCP database servers running

### First launch

Open [http://localhost:3000](http://localhost:3000) in your browser. You will see the chat interface in **Demo mode** — a sample e-commerce database (customers, products, orders) is pre-loaded so you can try queries immediately without connecting a real database.

---

## The Interface

```
┌─────────────────────────────────────────────────────────────────────┐
│  M mind-query  │ ◈ Demo  🐘 PostgreSQL  🐬 MySQL  🪟 SQL Server  🍃 │  ← Header
├─────────────┬───────────────────────────────────────────────────────┤
│             │                                                       │
│  customers  │   Welcome message                                     │
│  products   │                                                       │
│  orders     │   👤  Show me the 5 most recent orders                │  ← User msg
│             │                                                       │
│  ▶ customers│   AI  Found 5 results from orders, customers          │  ← AI msg
│   → top 10  │       ┌──────────────────────────────────────────────┐│
│   → count   │       │ ID │ Customer   │ Product      │ Status      ││
│             │       │────│────────────│──────────────│─────────────││
│  ▶ products │       │  8 │ Hoàng...   │ iPhone 15 Pro│ completed   ││
│  ▶ orders   │       └──────────────────────────────────────────────┘│
│             │       SQL ▼                                 [Copy]    │
│             │                                                       │
├─────────────┴───────────────────────────────────────────────────────┤
│  [Ask anything about your data...          ]              [➤ Send]  │  ← Input
│  Read-only • All requests are security-checked before execution     │
└─────────────────────────────────────────────────────────────────────┘
```

| Area | Description |
|---|---|
| **Header** | App logo, database selector tabs, Clear chat button |
| **Schema Sidebar** | Lists tables/collections in the active database; click to expand query suggestions |
| **Chat Area** | Conversation history — your questions and the agent's responses |
| **Input Bar** | Text area for your question; send with **Enter** or the arrow button |

---

## Asking Questions

Type your question in the input bar and press **Enter** (or **Shift+Enter** for a new line).

### What kinds of questions work?

mind-query handles any read-only question about your data:

| Category | Example |
|---|---|
| Simple lookup | `Show me all customers from Hanoi` |
| Filtering | `Orders with status "pending"` |
| Sorting | `Top 10 products by price, highest first` |
| Aggregation | `Total revenue by city` |
| Counting | `How many orders were placed last month?` |
| Joining | `Show customer name and total spend for each order` |
| Date filtering | `Products added in the last 30 days` |
| Schema exploration | `What tables are available?` / `Describe the orders table` |

### What is not allowed?

For safety, the system **only performs read operations**. Any request that would modify data is blocked before it reaches the database:

- `DELETE all orders from 2023` → **Blocked**
- `UPDATE customer email to ...` → **Blocked**
- `DROP TABLE users` → **Blocked**
- Prompt injection attempts → **Blocked**

The Security Gate analyzes every request and assigns a risk score (0–100). Requests scoring above 40 are blocked automatically.

---

## Switching Databases

The database tabs in the header let you switch between connected data sources.

| Tab | Status | What it means |
|---|---|---|
| **◈ Demo** | Always available | In-memory SQLite with sample data |
| **🐘 PostgreSQL** | Shown if `POSTGRES_MCP_URL` is set | Your PostgreSQL instance via MCP |
| **🐬 MySQL** | Shown if `MYSQL_MCP_URL` is set | Your MySQL instance via MCP |
| **🪟 SQL Server** | Shown if `SQLSERVER_MCP_URL` is set | Your SQL Server instance via MCP |
| **🍃 MongoDB** | Shown if `MONGODB_MCP_URL` is set | Your MongoDB instance via MCP |

Switching databases clears the chat history and reloads the schema sidebar for the new database.

---

## Reading Results

### Result table

Results are displayed as a paginated table directly in the chat. Each table shows:

- **Column headers** — field names from the database
- **Row data** — up to 20 rows per page; use `‹` / `›` to paginate
- **Row count** — total number of rows returned
- **Execution time** — how long the database query took

**Masked fields** are shown with a 🔒 icon. The system automatically redacts values in columns whose names match patterns like `password`, `email`, `phone`, `token`, `secret`, etc.

### Exporting to CSV

Click the **↓ CSV** button below any result table to download the full result set as a CSV file.

### SQL / MQL viewer

Every response includes the exact query the agent generated and sent to the database. Click **▼ Mở rộng** to see the full query; click **Sao chép** to copy it to your clipboard.

For SQL databases, keywords are syntax-highlighted. For MongoDB, the query is displayed as formatted JSON.

---

## Security Indicators

Every AI response displays a small badge showing the security verdict for that request:

| Badge | Meaning |
|---|---|
| `✓ An toàn (5)` | Request is safe, risk score 0–19 |
| `✓ Chú ý (35)` | Request is safe but contains some flagged patterns, score 20–39 |
| `✕ Bị chặn (92)` | Request was blocked; score ≥ 40 |

When a request is blocked, the chat shows a red error card explaining the detected threat pattern (e.g., `destructive_sql`, `prompt_injection`).

---

## Schema Browser

The sidebar on the left lists all tables (SQL) or collections (MongoDB) in the active database.

- **Click a table name** to expand it and see quick query suggestions
- **Click a suggestion** to automatically send that query for that table
- **Collapse the sidebar** using the `‹` toggle button on its right edge

The sidebar refreshes automatically when you switch databases.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Enter` | Send message |
| `Shift + Enter` | Insert a new line in the input |

---

## Query Tips & Examples

### Demo database schema

The Demo mode ships with three tables:

**customers** — `id, name, email, phone, city, country, created_at`

**products** — `id, name, category, price, stock`

**orders** — `id, customer_id, product_id, quantity, total_price, status, ordered_at`

### Example questions for Demo mode

```
Show me all customers
```
```
How many orders have status "completed"?
```
```
What is the average order total?
```
```
Top 3 most expensive products
```
```
Show total revenue per customer, sorted highest first
```
```
How many products are in stock across all categories?
```
```
List orders placed by customers from Ho Chi Minh City
```
```
What are the most popular product categories by number of orders?
```

### MongoDB-specific tips

When querying MongoDB, ask in the same natural language style. The agent generates a `find` or `aggregate` query automatically:

```
Show me 10 documents from the users collection
```
```
Count documents grouped by status field
```
```
Find all orders where total is greater than 1000000
```

### Getting better results

- **Be specific about columns:** "Show name and email of customers" is more precise than "show customer info"
- **Mention the table if ambiguous:** "orders placed in 2024" vs. "records from 2024"
- **Use exact values when filtering:** "status is 'completed'" rather than "finished orders"
- **Ask for limits explicitly if needed:** "Show me ALL customers" tells the agent to remove the default 100-row limit

---

## Troubleshooting

### "ANTHROPIC_API_KEY not configured"

Add your Anthropic API key to `.env.local`:
```env
ANTHROPIC_API_KEY=sk-ant-...
```
Then restart the development server.

---

### A database tab is not appearing

The database tabs are shown only when the corresponding MCP URL is set in `.env.local`. Check that:

1. The environment variable is present and correct
2. The MCP server process is running and reachable at that URL
3. You restarted `npm run dev` after editing `.env.local`

Test connectivity manually:
```bash
curl http://localhost:3101/health   # for PostgreSQL MCP (example)
```

---

### "Query failed after 3 retries"

This means the agent could not generate a valid query for your question. Try:

- Rephrasing the question more specifically
- Mentioning the table name explicitly
- Asking a simpler sub-question first to verify the schema

---

### Results show `●●●●●●●●` in some columns

This is the PII masking system working correctly. Columns matching patterns like `password`, `email`, `phone`, `token`, `secret`, `api_key`, `hash`, or `ssn` are automatically redacted regardless of their actual content.

This behaviour is intentional and cannot be disabled from the UI.

---

### The query ran but returned 0 rows

The agent generated a valid query that executed successfully, but no rows matched the filter. Try:

- Removing date filters that may be too narrow
- Checking the spelling of values you're filtering by (e.g., city names)
- Asking "What distinct values exist in the status column?" to understand the data

---

### I got a "Blocked" error for a harmless question

The Security Gate occasionally misclassifies legitimate questions that happen to contain words like "delete", "update", or "drop" in a non-SQL context (e.g., "How many items were dropped from the cart?").

Rephrase the question to avoid ambiguous phrasing:

- ❌ `"How many records were deleted last week?"`
- ✓ `"How many records have status 'deleted' or 'removed' in the last 7 days?"`

---

## FAQ

**Q: Does mind-query store my data anywhere?**

A: No. Query results are returned directly from your database to your browser. The only persistent storage is the `logs/audit.jsonl` file on the server, which records metadata (prompt text, security score, row count, execution time) — it does not store the actual row data.

---

**Q: Can I use mind-query with a cloud database?**

A: Yes, as long as the corresponding MCP server can reach the database. The MCP server handles the actual database connection; mind-query only talks to the MCP server URL you provide.

---

**Q: How does the agent know my schema?**

A: Before generating each query, the Data Agent calls `listTables()` and `getSchema()` on the active database executor. This fetches the current schema at query time — it always reflects the live database structure and does not require any manual configuration.

---

**Q: Is there a maximum query size?**

A: Input prompts are capped at 2,000 characters. Results are capped at 100 rows by default; the agent removes this cap only when you explicitly request all rows or when the query is an aggregation (COUNT, SUM, etc.).

---

**Q: Can I run multiple databases simultaneously?**

A: Yes — configure multiple MCP server URLs and switch between them using the database tabs. Each tab maintains its own schema; queries always run against the currently selected database.

---

**Q: What model does mind-query use?**

A: Claude Sonnet 4.6 (`claude-sonnet-4-6`) via the Anthropic API. The model is used for both the Security Gate and the Data Agent — each as a separate, isolated API call.
