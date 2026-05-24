import { ClaudeClient } from '@/infrastructure/llm/ClaudeClient'
import { McpClient } from '@/infrastructure/mcp/McpClient'
import { SecurityGateImpl } from '@/infrastructure/security/SecurityGateImpl'
import { SqlDataAgentImpl } from '@/infrastructure/agent/SqlDataAgentImpl'
import { MongoDataAgentImpl } from '@/infrastructure/agent/MongoDataAgentImpl'
import { OutputFilterImpl } from '@/infrastructure/filters/OutputFilterImpl'
import { FileAuditLogger } from '@/infrastructure/audit/FileAuditLogger'
import { PostgresMcpExecutor } from '@/infrastructure/database/PostgresMcpExecutor'
import { MySqlMcpExecutor } from '@/infrastructure/database/MySqlMcpExecutor'
import { SqlServerMcpExecutor } from '@/infrastructure/database/SqlServerMcpExecutor'
import { MongoDbMcpExecutor } from '@/infrastructure/database/MongoDbMcpExecutor'
import { DemoExecutor } from '@/infrastructure/database/DemoExecutor'
import { ValidateSecurityUseCase } from '@/core/use-cases/ValidateSecurityUseCase'
import { ExecuteQueryUseCase } from '@/core/use-cases/ExecuteQueryUseCase'
import { FilterOutputUseCase } from '@/core/use-cases/FilterOutputUseCase'
import { QueryPipeline } from '@/application/pipeline/QueryPipeline'
import type { IQueryExecutor } from '@/core/interfaces/IQueryExecutor'
import type { IDataAgent } from '@/core/interfaces/IDataAgent'

export type DbType = 'demo' | 'postgres' | 'mysql' | 'sqlserver' | 'mongodb'

export const DB_CONFIG: Record<DbType, { label: string; color: string; envKey: string }> = {
  demo:      { label: 'Demo',       color: '#6366f1', envKey: '' },
  postgres:  { label: 'PostgreSQL', color: '#336791', envKey: 'POSTGRES_MCP_URL' },
  mysql:     { label: 'MySQL',      color: '#f29111', envKey: 'MYSQL_MCP_URL' },
  sqlserver: { label: 'SQL Server', color: '#cc2927', envKey: 'SQLSERVER_MCP_URL' },
  mongodb:   { label: 'MongoDB',    color: '#10aa50', envKey: 'MONGODB_MCP_URL' },
}

function getClaudeClient(): ClaudeClient {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY không được cấu hình')
  return new ClaudeClient(key)
}

function createExecutor(dbType: DbType): IQueryExecutor {
  switch (dbType) {
    case 'postgres': {
      const url = process.env.POSTGRES_MCP_URL
      if (!url) throw new Error('POSTGRES_MCP_URL chưa được cấu hình')
      return new PostgresMcpExecutor(new McpClient(url))
    }
    case 'mysql': {
      const url = process.env.MYSQL_MCP_URL
      if (!url) throw new Error('MYSQL_MCP_URL chưa được cấu hình')
      return new MySqlMcpExecutor(new McpClient(url))
    }
    case 'sqlserver': {
      const url = process.env.SQLSERVER_MCP_URL
      if (!url) throw new Error('SQLSERVER_MCP_URL chưa được cấu hình')
      return new SqlServerMcpExecutor(new McpClient(url), process.env.SQLSERVER_SCHEMA ?? 'dbo')
    }
    case 'mongodb': {
      const url = process.env.MONGODB_MCP_URL
      if (!url) throw new Error('MONGODB_MCP_URL chưa được cấu hình')
      return new MongoDbMcpExecutor(new McpClient(url), process.env.MONGODB_DATABASE ?? 'mydb')
    }
    default:
      return new DemoExecutor()
  }
}

function createDataAgent(dbType: DbType, claude: ClaudeClient): IDataAgent {
  return dbType === 'mongodb' ? new MongoDataAgentImpl(claude) : new SqlDataAgentImpl(claude)
}

// Each pipeline is created fresh per request (stateless for serverless compatibility)
export function createPipeline(dbType: DbType): QueryPipeline {
  const claude = getClaudeClient()
  const executor = createExecutor(dbType)
  const agent = createDataAgent(dbType, claude)
  const logger = new FileAuditLogger()

  return new QueryPipeline(
    new ValidateSecurityUseCase(new SecurityGateImpl(claude)),
    new ExecuteQueryUseCase(agent),
    new FilterOutputUseCase(new OutputFilterImpl()),
    logger,
    executor
  )
}

export function getAvailableDbTypes(): DbType[] {
  const available: DbType[] = ['demo']
  if (process.env.POSTGRES_MCP_URL)  available.push('postgres')
  if (process.env.MYSQL_MCP_URL)     available.push('mysql')
  if (process.env.SQLSERVER_MCP_URL) available.push('sqlserver')
  if (process.env.MONGODB_MCP_URL)   available.push('mongodb')
  return available
}
