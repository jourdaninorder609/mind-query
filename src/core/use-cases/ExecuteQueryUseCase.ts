import type { IDataAgent } from '../interfaces/IDataAgent'
import type { IQueryExecutor } from '../interfaces/IQueryExecutor'
import type { QueryResult } from '../entities/QueryResult'

export class ExecuteQueryUseCase {
  constructor(private readonly agent: IDataAgent) {}

  execute(prompt: string, executor: IQueryExecutor): Promise<QueryResult> {
    return this.agent.process(prompt, executor)
  }
}
