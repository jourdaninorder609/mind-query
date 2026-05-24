import type { ILLMClient } from '@/core/interfaces/ILLMClient'
import Anthropic from '@anthropic-ai/sdk'

export class ClaudeClient implements ILLMClient {
  private readonly client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async complete(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const block = response.content[0]
    if (block.type !== 'text') throw new Error('Unexpected non-text response from Claude')
    return block.text
  }
}
