export interface QueryResult {
  query: string
  data: Record<string, unknown>[]
  rowCount: number
  executionTimeMs: number
  tablesAccessed: string[]
}
