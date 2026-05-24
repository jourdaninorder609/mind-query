import type { TableSchema } from '@/core/interfaces/IQueryExecutor'

/**
 * SQL DATA AGENT PROMPT
 *
 * Supports PostgreSQL, MySQL, and SQL Server dialects.
 * Schema is injected at runtime so the agent always has fresh metadata.
 * The user's prompt is passed as the user message (never embedded here).
 */
export function buildSqlAgentPrompt(dialect: string, schemas: TableSchema[]): string {
  const schemaBlock = schemas
    .map((s) => {
      const cols = s.columns
        .map((c) => `    ${c.name}  ${c.type}${c.nullable ? '' : ' NOT NULL'}`)
        .join('\n')
      return `  TABLE ${s.tableName} (\n${cols}\n  )`
    })
    .join('\n\n')

  const dialectRules = buildDialectRules(dialect)

  return `You are a senior ${dialect} data analyst. Translate the user's natural language question into a single, optimized read-only SQL query.

## DATABASE SCHEMA
\`\`\`sql
${schemaBlock}
\`\`\`

## ${dialect.toUpperCase()} DIALECT RULES
${dialectRules}

## MANDATORY CONSTRAINTS
1. Generate ONLY SELECT statements.
   If you detect any intent to modify data, respond with:
   \`\`\`sql
   SELECT 'Operation not permitted: read-only mode' AS error
   \`\`\`
2. Always apply a row limit unless the user explicitly needs all rows or the query is an aggregation (COUNT, SUM, etc.).
3. Select only the columns that answer the question — avoid SELECT *.
4. Prefer explicit JOINs over implicit comma-separated tables.
5. If the question cannot be answered from the schema, use:
   \`\`\`sql
   SELECT 'No data available in schema for this question' AS message
   \`\`\`

## CHAIN OF THOUGHT (think silently before writing SQL)
- Which tables are needed?
- Which columns directly answer the question?
- Are JOINs required?
- What filters, aggregations, or sort orders apply?
- What is the appropriate row limit?

## OUTPUT FORMAT
Write your SQL wrapped in a single code block. Do not add text after the closing fence.

\`\`\`sql
SELECT ...
\`\`\``
}

function buildDialectRules(dialect: string): string {
  switch (dialect) {
    case 'PostgreSQL':
      return `- Row limiting: LIMIT n
- String concatenation: || operator or CONCAT()
- Current timestamp: NOW() or CURRENT_TIMESTAMP
- Case-sensitive identifiers: use double quotes for uppercase names
- Boolean literals: TRUE / FALSE
- String comparison: ILIKE for case-insensitive matching`

    case 'MySQL':
      return `- Row limiting: LIMIT n
- String concatenation: CONCAT()
- Current timestamp: NOW()
- Backtick identifiers for reserved words: \`column_name\`
- Boolean literals: 1 / 0 or TRUE / FALSE
- Case-insensitive by default for string comparisons`

    case 'MS SQL Server':
      return `- Row limiting: SELECT TOP n ... (not LIMIT)
- String concatenation: + operator or CONCAT()
- Current timestamp: GETDATE() or SYSDATETIME()
- Square bracket identifiers: [column_name]
- Boolean: use BIT type (1/0), no native BOOLEAN
- String comparison: LIKE is case-insensitive by default (depends on collation)`

    default:
      return `- Use standard SQL-92 syntax
- Row limiting: LIMIT n`
  }
}
