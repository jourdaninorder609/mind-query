export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface LLMResponse {
  content: string | null
  tool_calls?: ToolCall[]
}

export interface ILLMClient {
  complete(systemPrompt: string, userMessage: string): Promise<string>
  completeWithTools(messages: LLMMessage[], tools: ToolDefinition[]): Promise<LLMResponse>
}
