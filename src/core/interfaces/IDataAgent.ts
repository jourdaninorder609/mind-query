import type { QueryResult } from '../entities/QueryResult'
import type { IQueryExecutor } from './IQueryExecutor'

export interface IDataAgent {
  process(prompt: string, executor: IQueryExecutor): Promise<QueryResult>
}
