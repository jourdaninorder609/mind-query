import { NextRequest, NextResponse } from 'next/server'
import { McpClient } from '@/infrastructure/mcp/McpClient'
import { PostgresMcpExecutor } from '@/infrastructure/database/PostgresMcpExecutor'
import { MySqlMcpExecutor } from '@/infrastructure/database/MySqlMcpExecutor'
import { SqlServerMcpExecutor } from '@/infrastructure/database/SqlServerMcpExecutor'
import { MongoDbMcpExecutor } from '@/infrastructure/database/MongoDbMcpExecutor'
import type { IQueryExecutor } from '@/core/interfaces/IQueryExecutor'

export async function POST(req: NextRequest) {
  const { dbType, url, execPath, startCommand, schema, database } = await req.json() as {
    dbType: string
    url?: string
    execPath?: string
    startCommand?: string
    schema?: string
    database?: string
  }

  // Determine transport mode
  const hasStdio = execPath?.trim() && startCommand?.trim()
  const hasUrl = url?.trim()

  if (!hasStdio && !hasUrl) {
    return NextResponse.json({ connected: false, error: 'Provide either a URL (SSE) or Exec Path + Start Cmd (stdio)' })
  }

  try {
    let mcp: McpClient
    if (hasStdio) {
      const [command, ...args] = startCommand!.trim().split(/\s+/)
      mcp = new McpClient({ type: 'stdio', command, args, cwd: execPath!.trim() })
    } else {
      mcp = new McpClient({ type: 'sse', url: url!.trim() })
    }

    let executor: IQueryExecutor
    switch (dbType) {
      case 'postgres':  executor = new PostgresMcpExecutor(mcp); break
      case 'mysql':     executor = new MySqlMcpExecutor(mcp); break
      case 'sqlserver': executor = new SqlServerMcpExecutor(mcp, schema ?? 'dbo'); break
      case 'mongodb':   executor = new MongoDbMcpExecutor(mcp, database ?? 'mydb'); break
      default: return NextResponse.json({ connected: false, error: 'Unsupported DB type' })
    }

    const start = Date.now()
    await executor.listTables()
    return NextResponse.json({ connected: true, latencyMs: Date.now() - start })
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    const clean = raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    return NextResponse.json({ connected: false, error: clean })
  }
}
