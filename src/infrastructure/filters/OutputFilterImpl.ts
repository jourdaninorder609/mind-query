import type { IOutputFilter, FilteredResult } from '@/core/interfaces/IOutputFilter'
import type { QueryResult } from '@/core/entities/QueryResult'

const PII_RULES: { pattern: RegExp; mask: (v: string) => string }[] = [
  { pattern: /password|passwd|secret|token|api_?key|hash|salt/i, mask: () => '●●●●●●●●' },
  { pattern: /email/i, mask: (v) => v.replace(/(.{2}).+(@.+)/, '$1•••$2') },
  { pattern: /phone|mobile|tel/i, mask: (v) => v.replace(/\d(?=\d{4})/g, '•') },
  { pattern: /ssn|national_?id|passport/i, mask: (v) => '•'.repeat(v.length) },
]

export class OutputFilterImpl implements IOutputFilter {
  async filter(result: QueryResult): Promise<FilteredResult> {
    const maskedFields: string[] = []

    const data = result.data.map((row) => {
      const out: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row)) {
        const rule = PII_RULES.find((r) => r.pattern.test(key))
        if (rule && typeof value === 'string') {
          out[key] = rule.mask(value)
          if (!maskedFields.includes(key)) maskedFields.push(key)
        } else {
          out[key] = value
        }
      }
      return out
    })

    return { data, rowCount: data.length, maskedFields }
  }
}
