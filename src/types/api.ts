import type { SecurityReport } from '@/core/entities/SecurityReport'

export interface QueryRequest {
  prompt: string
  dbType: string
}

export interface QuerySuccess {
  success: true
  securityReport: SecurityReport
  query: string
  data: Record<string, unknown>[]
  rowCount: number
  maskedFields: string[]
  executionTimeMs: number
  tablesAccessed: string[]
  dialect: string
}

export interface QueryBlocked {
  success: false
  blocked: true
  riskScore: number
  detectedPatterns: string[]
  error: string
}

export interface QueryError {
  success: false
  blocked?: false
  error: string
}

export type QueryResponse = QuerySuccess | QueryBlocked | QueryError

export interface SchemaResponse {
  tables: string[]
  dialect: string
  displayName: string
}

export interface HealthResponse {
  available: string[]
}
