import { NextRequest, NextResponse } from 'next/server'
import { readSettings } from '@/lib/settings'
import { DemoExecutor } from '@/infrastructure/database/DemoExecutor'
import { McpClient } from '@/infrastructure/mcp/McpClient'
import { PostgresMcpExecutor } from '@/infrastructure/database/PostgresMcpExecutor'
import { MySqlMcpExecutor } from '@/infrastructure/database/MySqlMcpExecutor'
import { SqlServerMcpExecutor } from '@/infrastructure/database/SqlServerMcpExecutor'
import { MongoDbMcpExecutor } from '@/infrastructure/database/MongoDbMcpExecutor'
import type { IQueryExecutor } from '@/core/interfaces/IQueryExecutor'
import type { McpServerConfig } from '@/lib/settings'

function buildMcpClient(cfg: McpServerConfig, fallbackUrl?: string): McpClient {
  const execPath = cfg.execPath?.trim()
  const startCmd = cfg.startCommand?.trim()
  if (execPath && startCmd) {
    const [command, ...args] = startCmd.split(/\s+/)
    return new McpClient({ type: 'stdio', command, args, cwd: execPath })
  }
  const url = cfg.url || fallbackUrl
  if (!url) throw new Error('No URL or execPath configured')
  return new McpClient({ type: 'sse', url })
}

export async function GET(req: NextRequest) {
  const dbType = req.nextUrl.searchParams.get('dbType') ?? 'demo'

  try {
    const cfg = readSettings()
    let executor: IQueryExecutor

    switch (dbType) {
      case 'postgres':
        executor = new PostgresMcpExecutor(buildMcpClient(cfg.postgres, process.env.POSTGRES_MCP_URL))
        break
      case 'mysql':
        executor = new MySqlMcpExecutor(buildMcpClient(cfg.mysql, process.env.MYSQL_MCP_URL))
        break
      case 'sqlserver':
        executor = new SqlServerMcpExecutor(
          buildMcpClient(cfg.sqlserver, process.env.SQLSERVER_MCP_URL),
          cfg.sqlserver.schema || process.env.SQLSERVER_SCHEMA || 'dbo'
        )
        break
      case 'mongodb':
        executor = new MongoDbMcpExecutor(
          buildMcpClient(cfg.mongodb, process.env.MONGODB_MCP_URL),
          cfg.mongodb.database || process.env.MONGODB_DATABASE || 'mydb'
        )
        break
      default:
        executor = new DemoExecutor()
    }

    const tables = await executor.listTables()
    return NextResponse.json({ tables, dialect: executor.getDialect(), displayName: executor.getDisplayName() })
  } catch {
    return NextResponse.json({ tables: [], dialect: dbType, displayName: dbType }, { status: 200 })
  }
}
