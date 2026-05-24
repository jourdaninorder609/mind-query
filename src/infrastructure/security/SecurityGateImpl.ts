import { SECURITY_GATE_PROMPT } from '@/application/prompts/securityGatePrompt'
import type { SecurityReport } from '@/core/entities/SecurityReport'
import type { ILLMClient } from '@/core/interfaces/ILLMClient'
import type { ISecurityGate } from '@/core/interfaces/ISecurityGate'

export class SecurityGateImpl implements ISecurityGate {
  constructor(private readonly llm: ILLMClient) {}

  async validate(prompt: string): Promise<SecurityReport> {
    // The user prompt is passed as the user message, never interpolated
    // into the system prompt — prevents Second-Order Prompt Injection.
    const response = await this.llm.complete(SECURITY_GATE_PROMPT, prompt)

    try {
      const match = response.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON in security response')

      const parsed = JSON.parse(match[0])
      return {
        isSafe: Boolean(parsed.isSafe),
        riskScore: Math.min(100, Math.max(0, Number(parsed.riskScore ?? 100))),
        reason: parsed.reason ?? undefined,
        detectedPatterns: Array.isArray(parsed.detectedPatterns) ? parsed.detectedPatterns : [],
      }
    } catch {
      return {
        isSafe: false,
        riskScore: 100,
        reason: 'Không thể phân tích bảo mật — chặn để an toàn',
        detectedPatterns: ['parse_failure'],
      }
    }
  }
}
