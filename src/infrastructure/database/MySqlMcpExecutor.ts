import type { IQueryExecutor, TableSchema } from '@/core/interfaces/IQueryExecutor'
import type { IMcpClient } from '../mcp/IMcpClient'

export class MySqlMcpExecutor implements IQueryExecutor {
  constructor(private readonly mcp: IMcpClient) {}

  getDialect() { return 'MySQL' }
  getDisplayName() { return 'MySQL' }

  async listTables(): Promise<string[]> {
    const result = await this.mcp.callTool<unknown>('list_tables')
    if (Array.isArray(result)) return result.map((r) => (typeof r === 'string' ? r : String(r.table_name ?? r.name ?? r)))
    if (result && typeof result === 'object' && 'tables' in result) return (result as { tables: string[] }).tables
    return []
  }

  async getSchema(tableName: string): Promise<TableSchema> {
    const result = await this.mcp.callTool<unknown>('describe_table', { table: tableName })
    const rows = Array.isArray(result) ? result : (result as { columns?: unknown[] })?.columns ?? []
    return {
      tableName,
      columns: (rows as Record<string, unknown>[]).map((r) => ({
        name: String(r.Field ?? r.column_name ?? r.name ?? ''),
        type: String(r.Type ?? r.data_type ?? r.type ?? 'varchar'),
        nullable: String(r.Null ?? r.is_nullable ?? 'YES') === 'YES',
      })),
    }
  }

  async executeQuery(sql: string): Promise<Record<string, unknown>[]> {
    const result = await this.mcp.callTool<unknown>('execute_query', { sql })
    if (Array.isArray(result)) return result as Record<string, unknown>[]
    if (result && typeof result === 'object' && 'rows' in result) return (result as { rows: Record<string, unknown>[] }).rows
    return []
  }
}
