import { QueryPipeline } from '@/application/pipeline/QueryPipeline'
import type { ILLMClient } from '@/core/interfaces/ILLMClient'
import { readSettings } from '@/lib/settings'
import type { McpServerConfig } from '@/lib/settings'
import type { IQueryExecutor } from '@/core/interfaces/IQueryExecutor'
import { ExecuteQueryUseCase } from '@/core/use-cases/ExecuteQueryUseCase'
import { FilterOutputUseCase } from '@/core/use-cases/FilterOutputUseCase'
import { ValidateSecurityUseCase } from '@/core/use-cases/ValidateSecurityUseCase'
import { SqlDataAgentImpl } from '@/infrastructure/agent/SqlDataAgentImpl'
import { ToolCallingDataAgent } from '@/infrastructure/agent/ToolCallingDataAgent'
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
  // Settings file takes priority over env vars
  const llm = readSettings().llm
  const provider = (llm.provider || 'anthropic').toLowerCase().trim()

  switch (provider) {
    case 'anthropic': {
      const key = llm.apiKey || process.env.ANTHROPIC_API_KEY
      if (!key) throw new Error('Anthropic API key is not configured. Add it in Settings → LLM Provider.')
      return new ClaudeClient(key)
    }

    case 'openai': {
      const key     = llm.apiKey  || process.env.LLM_API_KEY
      const baseURL = llm.baseUrl || process.env.LLM_BASE_URL
      const model   = llm.model   || process.env.LLM_MODEL
      if (!key)     throw new Error('API key is not configured. Add it in Settings → LLM Provider.')
      if (!baseURL) throw new Error('Base URL is not configured. Add it in Settings → LLM Provider.')
      if (!model)   throw new Error('Model is not configured. Add it in Settings → LLM Provider.')
      return new OpenAICompatibleClient(key, baseURL, model)
    }

    default:
      throw new Error(`Unsupported provider: "${provider}". Use "anthropic" or "openai".`)
  }
}

/**
 * Build an McpClient for a given server config.
 *
 * Transport selection:
 *   - If execPath + startCommand are set  → stdio mode (spawn the process directly)
 *   - Otherwise                           → SSE mode (connect to url)
 *
 * In stdio mode the full process.env is passed to the child, with cfg.uri
 * injected as the appropriate connection-string env var for each DB type.
 */
function buildMcpClient(
  cfg: McpServerConfig,
  fallbackUrl?: string,
  uriEnvKey?: string,
): McpClient {
  const execPath = cfg.execPath?.trim()
  const startCmd = cfg.startCommand?.trim()

  if (execPath && startCmd) {
    const [command, ...args] = startCmd.split(/\s+/)
    const envOverrides: Record<string, string> = {}
    if (uriEnvKey && cfg.uri?.trim()) envOverrides[uriEnvKey] = cfg.uri.trim()
    return new McpClient({ type: 'stdio', command, args, cwd: execPath, envOverrides })
  }

  const url = cfg.url || fallbackUrl
  if (!url) throw new Error('Neither execPath nor URL is configured for this MCP server')
  return new McpClient({ type: 'sse', url })
}

function isConfigured(cfg: McpServerConfig, envUrl?: string): boolean {
  return Boolean(cfg.execPath?.trim() || cfg.url || envUrl)
}


// Each pipeline is created fresh per request (stateless for serverless compatibility)
export function createPipeline(dbType: DbType): QueryPipeline {
  const llm    = getLLMClient()
  const logger = new FileAuditLogger()
  const security = new ValidateSecurityUseCase(new SecurityGateImpl(llm))
  const filter   = new FilterOutputUseCase(new OutputFilterImpl())

  if (dbType === 'demo') {
    const executor = new DemoExecutor()
    const agent    = new SqlDataAgentImpl(llm)
    return new QueryPipeline(security, new ExecuteQueryUseCase(agent), filter, logger, executor)
  }

  // Real DB: share one MCP client between executor and ToolCallingDataAgent
  const cfg = readSettings()
  let mcp: McpClient
  let executor: IQueryExecutor

  switch (dbType) {
    case 'postgres':
      if (!isConfigured(cfg.postgres, process.env.POSTGRES_MCP_URL))
        throw new Error('PostgreSQL is not configured (set Exec Path or URL in Settings)')
      mcp      = buildMcpClient(cfg.postgres, process.env.POSTGRES_MCP_URL, 'POSTGRES_URI')
      executor = new PostgresMcpExecutor(mcp)
      break
    case 'mysql':
      if (!isConfigured(cfg.mysql, process.env.MYSQL_MCP_URL))
        throw new Error('MySQL is not configured (set Exec Path or URL in Settings)')
      mcp      = buildMcpClient(cfg.mysql, process.env.MYSQL_MCP_URL, 'MYSQL_URI')
      executor = new MySqlMcpExecutor(mcp)
      break
    case 'sqlserver':
      if (!isConfigured(cfg.sqlserver, process.env.SQLSERVER_MCP_URL))
        throw new Error('SQL Server is not configured (set Exec Path or URL in Settings)')
      mcp      = buildMcpClient(cfg.sqlserver, process.env.SQLSERVER_MCP_URL, 'SQLSERVER_URI')
      executor = new SqlServerMcpExecutor(mcp, cfg.sqlserver.schema || process.env.SQLSERVER_SCHEMA || 'dbo')
      break
    case 'mongodb':
    default:
      if (!isConfigured(cfg.mongodb, process.env.MONGODB_MCP_URL))
        throw new Error('MongoDB is not configured (set Exec Path or URL in Settings)')
      mcp      = buildMcpClient(cfg.mongodb, process.env.MONGODB_MCP_URL, 'MONGODB_URI')
      executor = new MongoDbMcpExecutor(mcp, cfg.mongodb.database || process.env.MONGODB_DATABASE || 'mydb')
      break
  }

  const agent = new ToolCallingDataAgent(llm, mcp)
  return new QueryPipeline(security, new ExecuteQueryUseCase(agent), filter, logger, executor)
}

export function getAvailableDbTypes(): DbType[] {
  const cfg = readSettings()
  const available: DbType[] = ['demo']
  // A DB is available if it's enabled AND has either execPath (stdio) or URL (SSE) configured
  if (cfg.postgres.enabled  && isConfigured(cfg.postgres,  process.env.POSTGRES_MCP_URL))  available.push('postgres')
  if (cfg.mysql.enabled     && isConfigured(cfg.mysql,     process.env.MYSQL_MCP_URL))     available.push('mysql')
  if (cfg.sqlserver.enabled && isConfigured(cfg.sqlserver, process.env.SQLSERVER_MCP_URL)) available.push('sqlserver')
  if (cfg.mongodb.enabled   && isConfigured(cfg.mongodb,   process.env.MONGODB_MCP_URL))   available.push('mongodb')
  return available
}
