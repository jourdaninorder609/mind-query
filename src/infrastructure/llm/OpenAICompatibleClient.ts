import type { ILLMClient } from '@/core/interfaces/ILLMClient'
import OpenAI from 'openai'

export class OpenAICompatibleClient implements ILLMClient {
  private readonly client: OpenAI
  private readonly model: string

  constructor(apiKey: string, baseURL: string, model: string) {
    this.client = new OpenAI({ apiKey, baseURL })
    this.model = model
  }

  async complete(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Unexpected empty response from OpenAI-compatible API')
    return content
  }
}