import type { SecurityReport } from '../entities/SecurityReport'
import type { QueryResult } from '../entities/QueryResult'

export type AuditEventType = 'SECURITY_CHECK' | 'QUERY_EXECUTED' | 'OUTPUT_FILTERED' | 'ERROR'

export interface AuditEvent {
  type: AuditEventType
  timestamp: Date
  prompt?: string
  securityReport?: SecurityReport
  queryResult?: QueryResult
  error?: string
}

export interface IAuditLogger {
  log(event: AuditEvent): Promise<void>
}
