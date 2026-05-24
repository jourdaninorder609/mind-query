import { QueryPipeline } from '@/application/pipeline/QueryPipeline'
import type { IDataAgent } from '@/core/interfaces/IDataAgent'
import type { ILLMClient } from '@/core/interfaces/ILLMClient'
import type { IQueryExecutor } from '@/core/interfaces/IQueryExecutor'
import { ExecuteQueryUseCase } from '@/core/use-cases/ExecuteQueryUseCase'
import { FilterOutputUseCase } from '@/core/use-cases/FilterOutputUseCase'
import { ValidateSecurityUseCase } from '@/core/use-cases/ValidateSecurityUseCase'
import { MongoDataAgentImpl } from '@/infrastructure/agent/MongoDataAgentImpl'
import { SqlDataAgentImpl } from '@/infrastructure/agent/SqlDataAgentImpl'
import { FileAuditLogger } from '@/infrastructure/audit/FileAuditLogger'
import { DemoExecutor } from '@/infrastructure/database/DemoExecutor'
import { MongoDbMcpExecutor } from '@/infrastructure/database/MongoDbMcpExecutor'
import { MySqlMcpExecutor } from '@/infrastructure/database/MySqlMcpExecutor'
import { PostgresMcpExecutor } from '@/infrastructure/database/PostgresMcpExecutor'
import { SqlServerMcpExecutor } from '@/infrastructure/database/SqlServerMcpExecutor'
import { OutputFilterImpl } from '@/infrastructure/filters/OutputFilterImpl'
import { ClaudeClient } from '@/infrastructure/llm/ClaudeClient'
import { OpenAICompatibleClient } from '@/infrastructure/llm/OpenAICompatibleClient'
import { McpClient } from '@/infrastructure/mcp/McpClient'
import { SecurityGateImpl } from '@/infrastructure/security/SecurityGateImpl'

export type DbType = 'demo' | 'postgres' | 'mysql' | 'sqlserver' | 'mongodb'

export const DB_CONFIG: Record<DbType, { label: string; color: string; envKey: string }> = {
  demo:      { label: 'Demo',       color: '#6366f1', envKey: '' },
  postgres:  { label: 'PostgreSQL', color: '#336791', envKey: 'POSTGRES_MCP_URL' },
  mysql:     { label: 'MySQL',      color: '#f29111', envKey: 'MYSQL_MCP_URL' },
  sqlserver: { label: 'SQL Server', color: '#cc2927', envKey: 'SQLSERVER_MCP_URL' },
  mongodb:   { label: 'MongoDB',    color: '#10aa50', envKey: 'MONGODB_MCP_URL' },
}

/**
 * Create the appropriate LLM client based on LLM_PROVIDER env var.
 *
 * Supported providers:
 *   "anthropic"   — Anthropic Claude (default)
 *   "openai"      — OpenAI-compatible API (z.ai, OpenRouter, Together, etc.)
 *
 * Required env vars per provider:
 *   anthropic: ANTHROPIC_API_KEY
 *   openai:    LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
 */
function getLLMClient(): ILLMClient {
  const provider = (process.env.LLM_PROVIDER ?? 'anthropic').toLowerCase().trim()

  switch (provider) {
    case 'anthropic': {
      const key = process.env.ANTHROPIC_API_KEY
      if (!key) throw new Error('ANTHROPIC_API_KEY không được cấu hình')
      return new ClaudeClient(key)
    }

    case 'openai': {
      const key = process.env.LLM_API_KEY
      const baseURL = process.env.LLM_BASE_URL
      const model = process.env.LLM_MODEL
      if (!key) throw new Error('LLM_API_KEY không được cấu hình (cần cho OpenAI-compatible provider)')
      if (!baseURL) throw new Error('LLM_BASE_URL không được cấu hình (cần cho OpenAI-compatible provider)')
      if (!model) throw new Error('LLM_MODEL không được cấu hình (cần cho OpenAI-compatible provider)')
      return new OpenAICompatibleClient(key, baseURL, model)
    }

    default:
      throw new Error(`LLM_PROVIDER không hỗ trợ: "${provider}". Dùng "anthropic" hoặc "openai".`)
  }
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

function createDataAgent(dbType: DbType, llm: ILLMClient): IDataAgent {
  return dbType === 'mongodb' ? new MongoDataAgentImpl(llm) : new SqlDataAgentImpl(llm)
}

// Each pipeline is created fresh per request (stateless for serverless compatibility)
export function createPipeline(dbType: DbType): QueryPipeline {
  const llm = getLLMClient()
  const executor = createExecutor(dbType)
  const agent = createDataAgent(dbType, llm)
  const logger = new FileAuditLogger()

  return new QueryPipeline(
    new ValidateSecurityUseCase(new SecurityGateImpl(llm)),
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