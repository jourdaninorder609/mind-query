import type { IOutputFilter, FilteredResult } from '../interfaces/IOutputFilter'
import type { QueryResult } from '../entities/QueryResult'

export class FilterOutputUseCase {
  constructor(private readonly filter: IOutputFilter) {}

  execute(result: QueryResult): Promise<FilteredResult> {
    return this.filter.filter(result)
  }
}
