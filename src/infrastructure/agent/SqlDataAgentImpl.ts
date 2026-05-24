import type { IDataAgent } from '@/core/interfaces/IDataAgent'
import type { IQueryExecutor } from '@/core/interfaces/IQueryExecutor'
import type { QueryResult } from '@/core/entities/QueryResult'
import type { ClaudeClient } from '../llm/ClaudeClient'
import { buildSqlAgentPrompt } from '@/application/prompts/sqlDataAgentPrompt'

const MAX_RETRIES = 3
const SELECT_ONLY = /^\s*SELECT\b/i
const DANGEROUS = /\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|EXEC|EXECUTE|MERGE|REPLACE)\b/i

export class SqlDataAgentImpl implements IDataAgent {
  constructor(private readonly claude: ClaudeClient) {}

  async process(prompt: string, executor: IQueryExecutor): Promise<QueryResult> {
    const tables = await executor.listTables()
    const schemas = await Promise.all(tables.slice(0, 30).map((t) => executor.getSchema(t)))
    const systemPrompt = buildSqlAgentPrompt(executor.getDialect(), schemas)

    let lastError = ''
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const userMsg =
        attempt === 0
          ? prompt
          : `${prompt}\n\n[Lần ${attempt + 1}/${MAX_RETRIES}] Lỗi trước: "${lastError}". Vui lòng sửa câu SQL.`

      const response = await this.claude.complete(systemPrompt, userMsg)
      const match = response.match(/```sql\n([\s\S]*?)\n```/)
      if (!match) {
        lastError = 'Không tìm thấy SQL trong phản hồi'
        continue
      }

      const sql = match[1].trim()
      if (!SELECT_ONLY.test(sql) || DANGEROUS.test(sql)) {
        lastError = `Câu lệnh không phải SELECT: ${sql.substring(0, 60)}`
        continue
      }

      try {
        const start = Date.now()
        const data = await executor.executeQuery(sql)
        return {
          query: sql,
          data,
          rowCount: data.length,
          executionTimeMs: Date.now() - start,
          tablesAccessed: tables.filter((t) => new RegExp(`\\b${t}\\b`, 'i').test(sql)),
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 2 ** attempt * 300))
        }
      }
    }

    throw new Error(`Query thất bại sau ${MAX_RETRIES} lần thử. Lỗi cuối: ${lastError}`)
  }
}
