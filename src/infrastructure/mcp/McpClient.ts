import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import type { IMcpClient } from './IMcpClient'

export class McpClient implements IMcpClient {
  private readonly client: Client
  private connectionPromise: Promise<void> | null = null
  private connected = false

  constructor(private readonly serverUrl: string) {
    this.client = new Client(
      { name: 'mind-query', version: '1.0.0' },
      { capabilities: {} }
    )
  }

  private async connect(): Promise<void> {
    if (this.connected) return
    if (!this.connectionPromise) {
      this.connectionPromise = (async () => {
        const transport = new SSEClientTransport(new URL(this.serverUrl))
        await this.client.connect(transport)
        this.connected = true
      })()
    }
    return this.connectionPromise
  }

  isConnected(): boolean {
    return this.connected
  }

  async callTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    await this.connect()
    const result = await this.client.callTool({ name, arguments: args })

    type ContentBlock = { type: string; text?: string }
    const content = result.content as ContentBlock[] | undefined

    if (result.isError) {
      const errBlock = content?.[0]
      const errText = errBlock?.type === 'text' ? errBlock.text : 'Unknown MCP error'
      throw new Error(`MCP tool "${name}" error: ${errText}`)
    }

    const textBlock = content?.find((c) => c.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error(`MCP tool "${name}" returned no text content`)
    }

    const text = textBlock.text ?? ''
    try {
      return JSON.parse(text) as T
    } catch {
      return text as unknown as T
    }
  }
}
