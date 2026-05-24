import { NextRequest, NextResponse } from 'next/server'
import { DemoExecutor } from '@/infrastructure/database/DemoExecutor'
import { McpClient } from '@/infrastructure/mcp/McpClient'
import { PostgresMcpExecutor } from '@/infrastructure/database/PostgresMcpExecutor'
import { MySqlMcpExecutor } from '@/infrastructure/database/MySqlMcpExecutor'
import { SqlServerMcpExecutor } from '@/infrastructure/database/SqlServerMcpExecutor'
import { MongoDbMcpExecutor } from '@/infrastructure/database/MongoDbMcpExecutor'
import type { IQueryExecutor } from '@/core/interfaces/IQueryExecutor'

export async function GET(req: NextRequest) {
  const dbType = req.nextUrl.searchParams.get('dbType') ?? 'demo'

  try {
    let executor: IQueryExecutor

    switch (dbType) {
      case 'postgres':
        executor = new PostgresMcpExecutor(new McpClient(process.env.POSTGRES_MCP_URL!))
        break
      case 'mysql':
        executor = new MySqlMcpExecutor(new McpClient(process.env.MYSQL_MCP_URL!))
        break
      case 'sqlserver':
        executor = new SqlServerMcpExecutor(new McpClient(process.env.SQLSERVER_MCP_URL!), process.env.SQLSERVER_SCHEMA ?? 'dbo')
        break
      case 'mongodb':
        executor = new MongoDbMcpExecutor(new McpClient(process.env.MONGODB_MCP_URL!), process.env.MONGODB_DATABASE ?? 'mydb')
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
