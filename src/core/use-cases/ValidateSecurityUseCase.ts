import type { ISecurityGate } from '../interfaces/ISecurityGate'
import type { SecurityReport } from '../entities/SecurityReport'

export class ValidateSecurityUseCase {
  constructor(private readonly gate: ISecurityGate) {}

  execute(prompt: string): Promise<SecurityReport> {
    return this.gate.validate(prompt)
  }
}
