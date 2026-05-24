export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface IMcpClient {
  callTool<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T>
  listTools(): Promise<McpTool[]>
  isConnected(): boolean
}
