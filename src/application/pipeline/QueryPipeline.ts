import type { ValidateSecurityUseCase } from '@/core/use-cases/ValidateSecurityUseCase'
import type { ExecuteQueryUseCase } from '@/core/use-cases/ExecuteQueryUseCase'
import type { FilterOutputUseCase } from '@/core/use-cases/FilterOutputUseCase'
import type { IAuditLogger } from '@/core/interfaces/IAuditLogger'
import type { IQueryExecutor } from '@/core/interfaces/IQueryExecutor'
import type { FilteredResult } from '@/core/interfaces/IOutputFilter'
import type { SecurityReport } from '@/core/entities/SecurityReport'
import type { QueryResult } from '@/core/entities/QueryResult'

export interface PipelineResult {
  filteredResult: FilteredResult
  securityReport: SecurityReport
  queryResult: QueryResult
}

export class SecurityViolationError extends Error {
  constructor(
    public readonly riskScore: number,
    public readonly reason?: string,
    public readonly detectedPatterns: string[] = []
  ) {
    super(`[BLOCKED] Điểm rủi ro: ${riskScore}/100. ${reason ?? ''}`)
    this.name = 'SecurityViolationError'
  }
}

export class QueryPipeline {
  constructor(
    private readonly securityUseCase: ValidateSecurityUseCase,
    private readonly queryUseCase: ExecuteQueryUseCase,
    private readonly filterUseCase: FilterOutputUseCase,
    private readonly logger: IAuditLogger,
    private readonly executor: IQueryExecutor
  ) {}

  async run(userPrompt: string): Promise<PipelineResult> {
    // Layer 1: Security Gate
    const securityReport = await this.securityUseCase.execute(userPrompt)
    await this.logger.log({ type: 'SECURITY_CHECK', timestamp: new Date(), prompt: userPrompt, securityReport })

    if (!securityReport.isSafe) {
      throw new SecurityViolationError(securityReport.riskScore, securityReport.reason, securityReport.detectedPatterns)
    }

    // Layer 2: Data Agent
    const queryResult = await this.queryUseCase.execute(userPrompt, this.executor)
    await this.logger.log({ type: 'QUERY_EXECUTED', timestamp: new Date(), queryResult })

    // Layer 3: Output Filter
    const filteredResult = await this.filterUseCase.execute(queryResult)
    await this.logger.log({ type: 'OUTPUT_FILTERED', timestamp: new Date() })

    return { filteredResult, securityReport, queryResult }
  }
}
