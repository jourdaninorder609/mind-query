import type { SecurityReport } from '../entities/SecurityReport'

export interface ISecurityGate {
  validate(prompt: string): Promise<SecurityReport>
}
