import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface McpServerConfig {
  enabled: boolean
  url: string
  execPath: string      // path to MCP server directory (for stdio spawn)
  startCommand: string  // e.g. "npm start"
  uri: string           // connection string passed to MCP child process (e.g. mongodb://localhost:27017)
  database: string      // MongoDB: database name
  schema: string        // SQL Server: schema name
}

export interface LlmSettings {
  provider: string      // "anthropic" | "openai"
  apiKey: string        // ANTHROPIC_API_KEY or LLM_API_KEY
  baseUrl: string       // LLM_BASE_URL  (OpenAI-compatible only)
  model: string         // LLM_MODEL     (OpenAI-compatible only)
}

export interface AppSettings {
  llm: LlmSettings
  postgres:  McpServerConfig
  mysql:     McpServerConfig
  sqlserver: McpServerConfig
  mongodb:   McpServerConfig
}

export type McpKey = 'postgres' | 'mysql' | 'sqlserver' | 'mongodb'

const SETTINGS_PATH = join(process.cwd(), 'mcp-settings.json')

export function defaultLlmSettings(): LlmSettings {
  return {
    provider: process.env.LLM_PROVIDER ?? 'anthropic',
    apiKey:   process.env.ANTHROPIC_API_KEY ?? process.env.LLM_API_KEY ?? '',
    baseUrl:  process.env.LLM_BASE_URL ?? '',
    model:    process.env.LLM_MODEL ?? '',
  }
}

function defaultMcp(): Omit<AppSettings, 'llm'> {
  return {
    postgres: {
      enabled:      !!process.env.POSTGRES_MCP_URL,
      url:          process.env.POSTGRES_MCP_URL ?? '',
      execPath:     '',
      startCommand: 'npm start',
      uri:          process.env.POSTGRES_URI ?? '',
      database:     '',
      schema:       '',
    },
    mysql: {
      enabled:      !!process.env.MYSQL_MCP_URL,
      url:          process.env.MYSQL_MCP_URL ?? '',
      execPath:     '',
      startCommand: 'npm start',
      uri:          process.env.MYSQL_URI ?? '',
      database:     '',
      schema:       '',
    },
    sqlserver: {
      enabled:      !!process.env.SQLSERVER_MCP_URL,
      url:          process.env.SQLSERVER_MCP_URL ?? '',
      execPath:     '',
      startCommand: 'npm start',
      uri:          process.env.SQLSERVER_URI ?? '',
      database:     '',
      schema:       process.env.SQLSERVER_SCHEMA ?? 'dbo',
    },
    mongodb: {
      enabled:      !!process.env.MONGODB_MCP_URL,
      url:          process.env.MONGODB_MCP_URL ?? '',
      execPath:     '',
      startCommand: 'npm start',
      uri:          process.env.MONGODB_URI ?? '',
      database:     process.env.MONGODB_DATABASE ?? 'mydb',
      schema:       '',
    },
  }
}

export function defaultSettings(): AppSettings {
  return { llm: defaultLlmSettings(), ...defaultMcp() }
}

export function readSettings(): AppSettings {
  try {
    if (existsSync(SETTINGS_PATH)) {
      const raw = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8')) as Partial<AppSettings>
      const def = defaultSettings()
      return {
        llm:       { ...def.llm,       ...raw.llm },
        postgres:  { ...def.postgres,  ...raw.postgres },
        mysql:     { ...def.mysql,     ...raw.mysql },
        sqlserver: { ...def.sqlserver, ...raw.sqlserver },
        mongodb:   { ...def.mongodb,   ...raw.mongodb },
      }
    }
  } catch {
    // Fall back to defaults on any read/parse error
  }
  return defaultSettings()
}

export function writeSettings(settings: AppSettings): void {
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
}

// Legacy alias — container still imports McpSettings for MCP-only slice
export type McpSettings = Omit<AppSettings, 'llm'>
