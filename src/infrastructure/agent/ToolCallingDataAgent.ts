import type { QueryResult } from '@/core/entities/QueryResult'
import type { IDataAgent } from '@/core/interfaces/IDataAgent'
import type { ILLMClient, LLMMessage, ToolDefinition } from '@/core/interfaces/ILLMClient'
import type { IQueryExecutor } from '@/core/interfaces/IQueryExecutor'
import type { IMcpClient } from '@/infrastructure/mcp/IMcpClient'

const MAX_ITERATIONS = 8

const SYSTEM_PROMPT = `You are a data analyst with direct access to database tools.
Use the provided tools to answer the user's question about their data.
- Always call tools to retrieve real data; never make assumptions about database contents.
- Chain tool calls as needed (e.g. list databases → list collections → find documents).
- After retrieving the data, stop calling tools and provide a concise summary.`

function normalizeResult(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return []
    const first = raw[0]
    // string[] → wrap each item as an object
    if (typeof first === 'string') return (raw as string[]).map((v) => ({ name: v }))
    // number/primitive → wrap
    if (typeof first !== 'object') return (raw as unknown[]).map((v) => ({ value: v }))
    return raw as Record<string, unknown>[]
  }
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    if (Array.isArray(r.documents))   return normalizeResult(r.documents)
    if (Array.isArray(r.results))     return normalizeResult(r.results)
    if (Array.isArray(r.collections)) return normalizeResult(r.collections)
    if (Array.isArray(r.databases))   return normalizeResult(r.databases)
    return [r]
  }
  return []
}

export class ToolCallingDataAgent implements IDataAgent {
  constructor(
    private readonly llm: ILLMClient,
    private readonly mcp: IMcpClient,
  ) {}

  async process(_prompt: string, _executor: IQueryExecutor): Promise<QueryResult>
  async process(prompt: string): Promise<QueryResult>
  async process(prompt: string): Promise<QueryResult> {
    const start = Date.now()

    const mcpTools = await this.mcp.listTools()
    const tools: ToolDefinition[] = mcpTools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    }))

    const messages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: prompt },
    ]

    let lastQuery = ''
    let lastData: Record<string, unknown>[] = []
    const tablesAccessed: string[] = []

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await this.llm.completeWithTools(messages, tools)

      if (!response.tool_calls || response.tool_calls.length === 0) break

      messages.push({
        role: 'assistant',
        content: response.content ?? '',
        tool_calls: response.tool_calls,
      })

      for (const tc of response.tool_calls) {
        // Track which collections/tables were accessed
        const col = tc.arguments.collection ?? tc.arguments.table ?? tc.arguments.name
        if (typeof col === 'string' && col) tablesAccessed.push(col)

        let resultRaw: unknown
        let resultContent: string
        try {
          resultRaw    = await this.mcp.callTool(tc.name, tc.arguments)
          resultContent = JSON.stringify(resultRaw)
        } catch (err) {
          resultContent = `Error: ${err instanceof Error ? err.message : String(err)}`
          resultRaw     = []
        }

        // Keep track of the last data-returning tool call
        const normalized = normalizeResult(resultRaw)
        if (normalized.length > 0) {
          lastData  = normalized
          lastQuery = JSON.stringify({ tool: tc.name, arguments: tc.arguments }, null, 2)
        }

        messages.push({ role: 'tool', tool_call_id: tc.id, content: resultContent })
      }
    }

    return {
      query:           lastQuery,
      data:            lastData,
      rowCount:        lastData.length,
      executionTimeMs: Date.now() - start,
      tablesAccessed:  [...new Set(tablesAccessed)],
    }
  }
}
