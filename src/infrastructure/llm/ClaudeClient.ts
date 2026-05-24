import type { ILLMClient, LLMMessage, LLMResponse, ToolDefinition } from '@/core/interfaces/ILLMClient'
import Anthropic from '@anthropic-ai/sdk'

export class ClaudeClient implements ILLMClient {
  private readonly client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async complete(systemPrompt: string, userMessage: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      })

      const block = response.content[0]
      if (block.type !== 'text') throw new Error('Unexpected non-text response from Claude')
      return block.text
    } catch (err) {
      throw this.wrapError(err)
    }
  }

  async completeWithTools(messages: LLMMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
    try {
      const systemMsg = messages.find((m) => m.role === 'system')

      const anthropicMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m): Anthropic.MessageParam => {
          if (m.role === 'tool') {
            return {
              role: 'user',
              content: [{ type: 'tool_result', tool_use_id: m.tool_call_id!, content: m.content }],
            }
          }
          if (m.tool_calls && m.tool_calls.length > 0) {
            return {
              role: 'assistant',
              content: m.tool_calls.map((tc) => ({
                type: 'tool_use' as const,
                id: tc.id,
                name: tc.name,
                input: tc.arguments,
              })),
            }
          }
          return { role: m.role as 'user' | 'assistant', content: m.content }
        })

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemMsg?.content,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters as Anthropic.Tool['input_schema'],
        })),
        messages: anthropicMessages,
      })

      const toolCalls = response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        .map((b) => ({ id: b.id, name: b.name, arguments: b.input as Record<string, unknown> }))

      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')

      return {
        content: textBlock?.text ?? null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      }
    } catch (err) {
      throw this.wrapError(err)
    }
  }

  private wrapError(err: unknown): Error {
    const raw = err instanceof Error ? err.message : String(err)
    const status = (err as { status?: number }).status
    if (status === 401 || status === 403) {
      return new Error(`Anthropic API error ${status}: invalid API key. Check Settings → LLM Provider.`)
    }
    return new Error(`Anthropic API error: ${raw}`)
  }
}
