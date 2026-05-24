export interface IMcpClient {
  callTool<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T>
  isConnected(): boolean
}
