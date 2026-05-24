export interface ILLMClient {
  complete(systemPrompt: string, userMessage: string): Promise<string>
}