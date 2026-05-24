export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
}

export interface TableSchema {
  tableName: string
  columns: ColumnInfo[]
}

export interface IQueryExecutor {
  getDialect(): string
  getDisplayName(): string
  listTables(): Promise<string[]>
  getSchema(tableName: string): Promise<TableSchema>
  executeQuery(query: string): Promise<Record<string, unknown>[]>
}
