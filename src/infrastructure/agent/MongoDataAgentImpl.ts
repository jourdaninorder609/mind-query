import type { IDataAgent } from '@/core/interfaces/IDataAgent'
import type { IQueryExecutor } from '@/core/interfaces/IQueryExecutor'
import type { QueryResult } from '@/core/entities/QueryResult'
import type { ClaudeClient } from '../llm/ClaudeClient'
import { buildMongoAgentPrompt } from '@/application/prompts/mongoDataAgentPrompt'

const MAX_RETRIES = 3

export class MongoDataAgentImpl implements IDataAgent {
  constructor(private readonly claude: ClaudeClient) {}

  async process(prompt: string, executor: IQueryExecutor): Promise<QueryResult> {
    const collections = await executor.listTables()
    const database = process.env.MONGODB_DATABASE ?? 'mydb'
    const systemPrompt = buildMongoAgentPrompt(database, collections)

    let lastError = ''
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const userMsg =
        attempt === 0
          ? prompt
          : `${prompt}\n\n[Lần ${attempt + 1}/${MAX_RETRIES}] Lỗi trước: "${lastError}". Vui lòng sửa query.`

      const response = await this.claude.complete(systemPrompt, userMsg)
      const match = response.match(/```json\n([\s\S]*?)\n```/)
      if (!match) {
        lastError = 'Không tìm thấy JSON trong phản hồi'
        continue
      }

      try {
        JSON.parse(match[1]) // validate JSON before passing to executor
      } catch {
        lastError = 'JSON không hợp lệ'
        continue
      }

      try {
        const start = Date.now()
        const data = await executor.executeQuery(match[1].trim())
        return {
          query: match[1].trim(),
          data,
          rowCount: data.length,
          executionTimeMs: Date.now() - start,
          tablesAccessed: collections.filter((c) => match[1].includes(c)),
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 2 ** attempt * 300))
        }
      }
    }

    throw new Error(`MongoDB query thất bại sau ${MAX_RETRIES} lần thử. Lỗi cuối: ${lastError}`)
  }
}
