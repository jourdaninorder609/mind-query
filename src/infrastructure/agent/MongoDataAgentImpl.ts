import { buildMongoAgentPrompt } from '@/application/prompts/mongoDataAgentPrompt'
import type { QueryResult } from '@/core/entities/QueryResult'
import type { IDataAgent } from '@/core/interfaces/IDataAgent'
import type { ILLMClient } from '@/core/interfaces/ILLMClient'
import type { IQueryExecutor } from '@/core/interfaces/IQueryExecutor'

const MAX_RETRIES = 3

export class MongoDataAgentImpl implements IDataAgent {
  constructor(private readonly llm: ILLMClient) {}

  async process(prompt: string, executor: IQueryExecutor): Promise<QueryResult> {
    const collections = await executor.listTables()
    const database = process.env.MONGODB_DATABASE ?? 'mydb'
    const systemPrompt = buildMongoAgentPrompt(database, collections)

    let lastError = ''
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const userMsg =
        attempt === 0
          ? prompt
          : `${prompt}\n\n[Attempt ${attempt + 1}/${MAX_RETRIES}] Previous error: "${lastError}". Please fix the query.`

      const response = await this.llm.complete(systemPrompt, userMsg)
      const match = response.match(/```json\n([\s\S]*?)\n```/)
      if (!match) {
        lastError = 'No JSON found in response'
        continue
      }

      try {
        JSON.parse(match[1]) // validate JSON before passing to executor
      } catch {
        lastError = 'Invalid JSON'
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

    throw new Error(`MongoDB query failed after ${MAX_RETRIES} attempts. Last error: ${lastError}`)
  }
}