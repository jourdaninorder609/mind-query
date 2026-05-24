export interface SecurityReport {
  isSafe: boolean
  riskScore: number
  reason?: string
  detectedPatterns: string[]
}
