import type { ILLMClient, LLMMessage, LLMResponse, ToolDefinition } from '@/core/interfaces/ILLMClient'
import OpenAI from 'openai'

export class OpenAICompatibleClient implements ILLMClient {
  private readonly client: OpenAI
  private readonly model: string
  private readonly baseURL: string

  constructor(apiKey: string, baseURL: string, model: string) {
    this.baseURL = baseURL
    this.model = model
    this.client = new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders: {
        'HTTP-Referer': 'https://cline.bot',
        'X-Title': 'Cline',
      },
    })
  }

  async complete(systemPrompt: string, userMessage: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('Unexpected empty response from LLM')
      return content
    } catch (err) {
      throw this.wrapError(err)
    }
  }

  async completeWithTools(messages: LLMMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 4096,
        tools: tools.map((t) => ({
          type: 'function' as const,
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
        messages: messages.map((m) => {
          if (m.role === 'tool') {
            return { role: 'tool' as const, tool_call_id: m.tool_call_id!, content: m.content }
          }
          if (m.tool_calls && m.tool_calls.length > 0) {
            return {
              role: 'assistant' as const,
              content: m.content || null,
              tool_calls: m.tool_calls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
              })),
            }
          }
          return { role: m.role as 'system' | 'user' | 'assistant', content: m.content }
        }),
      })

      const msg = response.choices[0].message
      type FnToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
      const toolCalls = (msg.tool_calls as FnToolCall[] | undefined)
        ?.filter((tc) => tc.type === 'function')
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
        }))

      return {
        content: msg.content ?? null,
        tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      }
    } catch (err) {
      throw this.wrapError(err)
    }
  }

  private wrapError(err: unknown): Error {
    const raw = err instanceof Error ? err.message : String(err)
    const status = (err as { status?: number }).status
    if (status === 404) {
      return new Error(
        `LLM API error 404: endpoint not found at "${this.baseURL}". ` +
        `Check Base URL in Settings → LLM Provider.`
      )
    }
    if (status === 401 || status === 403) {
      return new Error(`LLM API error ${status}: invalid API key. Check Settings → LLM Provider.`)
    }
    return new Error(`LLM API error: ${raw}`)
  }
}
