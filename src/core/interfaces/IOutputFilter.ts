import type { QueryResult } from '../entities/QueryResult'

export interface FilteredResult {
  data: Record<string, unknown>[]
  rowCount: number
  maskedFields: string[]
}

export interface IOutputFilter {
  filter(result: QueryResult): Promise<FilteredResult>
}
