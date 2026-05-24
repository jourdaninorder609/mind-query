import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { IMcpClient, McpTool } from './IMcpClient'

export type McpClientConfig =
  | { type: 'sse'; url: string }
  | { type: 'stdio'; command: string; args: string[]; cwd: string; envOverrides?: Record<string, string> }

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function safeEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)
  )
}

export class McpClient implements IMcpClient {
  private readonly client: Client
  private connectionPromise: Promise<void> | null = null
  private connected = false

  constructor(private readonly config: McpClientConfig) {
    this.client = new Client(
      { name: 'mind-query', version: '1.0.0' },
      { capabilities: {} }
    )
  }

  private get label(): string {
    return this.config.type === 'sse'
      ? this.config.url
      : `${this.config.command} ${this.config.args.join(' ')} (stdio)`
  }

  private async connect(): Promise<void> {
    if (this.connected) return
    if (!this.connectionPromise) {
      this.connectionPromise = (async () => {
        let transport
        if (this.config.type === 'sse') {
          transport = new SSEClientTransport(new URL(this.config.url))
        } else {
          transport = new StdioClientTransport({
            command: this.config.command,
            args:    this.config.args,
            cwd:     this.config.cwd,
            // Pass the full server env so .env.local vars (e.g. MONGODB_URI) reach the process
            env: { ...safeEnv(), ...this.config.envOverrides },
          })
        }
        await this.client.connect(transport)
        this.connected = true
      })().catch((err) => {
        this.connectionPromise = null // reset so the next request can retry
        const raw = err instanceof Error ? err.message : String(err)
        const clean = stripHtml(raw).substring(0, 200)
        throw new Error(`Cannot connect to MCP server (${this.label}). ${clean || 'Connection failed'}`)
      })
    }
    return this.connectionPromise
  }

  isConnected(): boolean {
    return this.connected
  }

  async listTools(): Promise<McpTool[]> {
    await this.connect()
    const result = await this.client.listTools()
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description ?? t.name,
      inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
    }))
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
