'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings, LlmSettings, McpKey } from '@/lib/settings'
import type { BrowseResult } from '@/app/api/settings/browse/route'

const DB_META: Record<McpKey, { icon: string; label: string; color: string; hasDatabase: boolean; hasSchema: boolean }> = {
  postgres:  { icon: '🐘', label: 'PostgreSQL', color: '#336791', hasDatabase: false, hasSchema: false },
  mysql:     { icon: '🐬', label: 'MySQL',       color: '#f29111', hasDatabase: false, hasSchema: false },
  sqlserver: { icon: '🪟', label: 'SQL Server',  color: '#cc2927', hasDatabase: false, hasSchema: true  },
  mongodb:   { icon: '🍃', label: 'MongoDB',     color: '#10aa50', hasDatabase: true,  hasSchema: false },
}

const DB_KEYS: McpKey[] = ['postgres', 'mysql', 'sqlserver', 'mongodb']

type TestStatus = 'idle' | 'testing' | 'ok' | 'error'
type ProcStatus = 'running' | 'stopped' | 'error' | 'starting' | 'stopping'

interface RowState {
  enabled: boolean
  url: string
  execPath: string
  startCommand: string
  uri: string
  database: string
  schema: string
  testStatus: TestStatus
  testLatency?: number
  testError?: string
  procStatus: ProcStatus
  logsOpen: boolean
  logs: string[]
  saving: boolean
}

type Rows = Record<McpKey, RowState>

function emptyRow(): RowState {
  return {
    enabled: false, url: '', execPath: '', startCommand: 'npm start',
    uri: '', database: '', schema: '',
    testStatus: 'idle', procStatus: 'stopped',
    logsOpen: false, logs: [], saving: false,
  }
}

interface Props {
  onClose: () => void
  onSettingsChanged: () => void
}

function emptyLlm(): LlmSettings {
  return { provider: 'anthropic', apiKey: '', baseUrl: '', model: '' }
}

export function SettingsModal({ onClose, onSettingsChanged }: Props) {
  const [rows, setRows] = useState<Rows>(() =>
    Object.fromEntries(DB_KEYS.map((k) => [k, emptyRow()])) as Rows
  )
  const [llm, setLlm] = useState<LlmSettings>(emptyLlm())
  const [llmSaving, setLlmSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load settings + process statuses on mount ──────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then((r) => r.json()) as Promise<AppSettings>,
      fetch('/api/settings/processes').then((r) => r.json()) as Promise<Record<string, string>>,
    ]).then(([cfg, procs]) => {
      if (cfg.llm) setLlm(cfg.llm)
      setRows((prev) => {
        const next = { ...prev }
        for (const k of DB_KEYS) {
          next[k] = {
            ...emptyRow(),
            enabled:      cfg[k].enabled,
            url:          cfg[k].url,
            execPath:     cfg[k].execPath,
            startCommand: cfg[k].startCommand || 'npm start',
            uri:          cfg[k].uri ?? '',
            database:     cfg[k].database,
            schema:       cfg[k].schema,
            procStatus:   (procs[k] as ProcStatus) ?? 'stopped',
          }
        }
        return next
      })
      setLoading(false)
    })

    // Poll process statuses every 3s
    pollRef.current = setInterval(() => {
      fetch('/api/settings/processes')
        .then((r) => r.json() as Promise<Record<string, string>>)
        .then((procs) =>
          setRows((prev) => {
            const next = { ...prev }
            for (const k of DB_KEYS) {
              next[k] = { ...next[k], procStatus: (procs[k] as ProcStatus) ?? 'stopped' }
            }
            return next
          })
        )
        .catch(() => {})
    }, 3000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────
  function patchRow(k: McpKey, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }))
  }

  function buildAppSettings(r: Rows, currentLlm: LlmSettings): AppSettings {
    const mcp = Object.fromEntries(
      DB_KEYS.map((k) => [k, {
        enabled:      r[k].enabled,
        url:          r[k].url,
        execPath:     r[k].execPath,
        startCommand: r[k].startCommand,
        uri:          r[k].uri,
        database:     r[k].database,
        schema:       r[k].schema,
      }])
    )
    return { llm: currentLlm, ...mcp } as unknown as AppSettings
  }

  const saveLlm = useCallback(async () => {
    setLlmSaving(true)
    try {
      setRows((prev) => {
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildAppSettings(prev, llm)),
        }).then(() => onSettingsChanged()).catch(() => {})
        return prev
      })
    } finally {
      setTimeout(() => setLlmSaving(false), 600)
    }
  }, [llm, onSettingsChanged])

  const saveRow = useCallback(async (k: McpKey) => {
    patchRow(k, { saving: true })
    setRows((prev) => {
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAppSettings(prev, llm)),
      }).then(() => {
        onSettingsChanged()
        setRows((p) => ({ ...p, [k]: { ...p[k], saving: false } }))
      }).catch(() => {
        setRows((p) => ({ ...p, [k]: { ...p[k], saving: false } }))
      })
      return { ...prev, [k]: { ...prev[k], saving: true } }
    })
  }, [llm, onSettingsChanged])

  const testConnection = useCallback(async (k: McpKey) => {
    patchRow(k, { testStatus: 'testing', testError: undefined, testLatency: undefined })
    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbType: k,
          url:          rows[k].url,
          execPath:     rows[k].execPath,
          startCommand: rows[k].startCommand,
          schema:       rows[k].schema,
          database:     rows[k].database,
        }),
      })
      const data = await res.json() as { connected: boolean; latencyMs?: number; error?: string }
      patchRow(k, {
        testStatus: data.connected ? 'ok' : 'error',
        testLatency: data.latencyMs,
        testError: data.error,
      })
    } catch {
      patchRow(k, { testStatus: 'error', testError: 'Network error' })
    }
  }, [rows])

  const startProc = useCallback(async (k: McpKey) => {
    patchRow(k, { procStatus: 'starting' })
    try {
      const res = await fetch('/api/settings/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: k, execPath: rows[k].execPath, startCommand: rows[k].startCommand }),
      })
      const data = await res.json() as { ok: boolean; status?: string; error?: string }
      patchRow(k, { procStatus: (data.status as ProcStatus) ?? (data.ok ? 'running' : 'error') })
    } catch {
      patchRow(k, { procStatus: 'error' })
    }
  }, [rows])

  const stopProc = useCallback(async (k: McpKey) => {
    patchRow(k, { procStatus: 'stopping' })
    try {
      await fetch('/api/settings/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: k }),
      })
    } finally {
      patchRow(k, { procStatus: 'stopped' })
    }
  }, [])

  const loadLogs = useCallback(async (k: McpKey) => {
    const res = await fetch(`/api/settings/processes?logs=${k}`)
    const data = await res.json() as { logs: string[] }
    patchRow(k, { logs: data.logs, logsOpen: true })
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal card */}
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-300">⚙</span>
            <h2 className="font-semibold text-slate-100">MCP Server Configuration</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 transition-colors text-lg leading-none px-1">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading configuration…</div>
          ) : (
            <div className="divide-y divide-slate-700/60">

              {/* ── LLM Provider section ─────────────────────────────────── */}
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🤖</span>
                    <span className="font-medium text-slate-200">LLM Provider</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* Provider selector */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-20 flex-shrink-0 text-right">Provider</span>
                    <select
                      value={llm.provider}
                      onChange={(e) => setLlm((p) => ({ ...p, provider: e.target.value }))}
                      className="flex-1 bg-slate-800 border border-slate-600 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none transition-colors"
                    >
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="openai">OpenAI-compatible (OpenRouter, Together, etc.)</option>
                    </select>
                  </div>

                  {/* API Key */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-20 flex-shrink-0 text-right">API Key</span>
                    <input
                      type="password"
                      value={llm.apiKey}
                      onChange={(e) => setLlm((p) => ({ ...p, apiKey: e.target.value }))}
                      placeholder={llm.provider === 'anthropic' ? 'sk-ant-…' : 'your-api-key'}
                      className="flex-1 bg-slate-800 border border-slate-600 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors"
                    />
                  </div>

                  {/* Base URL — only for openai-compatible */}
                  {llm.provider === 'openai' && (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-20 flex-shrink-0 text-right">Base URL</span>
                        <input
                          value={llm.baseUrl}
                          onChange={(e) => setLlm((p) => ({ ...p, baseUrl: e.target.value }))}
                          placeholder="https://openrouter.ai/api/v1"
                          className="flex-1 bg-slate-800 border border-slate-600 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-20 flex-shrink-0 text-right">Model</span>
                        <input
                          value={llm.model}
                          onChange={(e) => setLlm((p) => ({ ...p, model: e.target.value }))}
                          placeholder="anthropic/claude-3-5-sonnet"
                          className="flex-1 bg-slate-800 border border-slate-600 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={saveLlm}
                    disabled={llmSaving}
                    className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors font-medium"
                  >
                    {llmSaving ? '⟳ Saving…' : '✓ Save'}
                  </button>
                </div>
              </div>

              {/* ── MCP server rows ───────────────────────────────────────── */}
              {DB_KEYS.map((k) => (
                <DbRow
                  key={k}
                  dbKey={k}
                  row={rows[k]}
                  onChange={(patch) => patchRow(k, patch)}
                  onSave={() => saveRow(k)}
                  onTest={() => testConnection(k)}
                  onStart={() => startProc(k)}
                  onStop={() => stopProc(k)}
                  onLoadLogs={() => loadLogs(k)}
                  onCloseLogs={() => patchRow(k, { logsOpen: false })}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700 flex-shrink-0">
          <p className="text-xs text-slate-500 text-center">
            Configuration saved to <code className="text-slate-400">mcp-settings.json</code> · Exec Path is used to start/stop MCP server processes
          </p>
        </div>
      </div>
    </div>
  )
}

// ── DbRow subcomponent ───────────────────────────────────────────────────
interface DbRowProps {
  dbKey: McpKey
  row: RowState
  onChange: (patch: Partial<RowState>) => void
  onSave: () => void
  onTest: () => void
  onStart: () => void
  onStop: () => void
  onLoadLogs: () => void
  onCloseLogs: () => void
}

function DbRow({ dbKey, row, onChange, onSave, onTest, onStart, onStop, onLoadLogs, onCloseLogs }: DbRowProps) {
  const meta    = DB_META[dbKey]
  const hasExec = row.execPath.trim().length > 0
  const hasUrl  = row.url.trim().length > 0
  // stdio mode: exec path set; SSE mode: url set without exec path
  const isStdio = hasExec
  const canTest  = isStdio ? !!(row.startCommand.trim()) : hasUrl
  const canStart = hasExec && row.procStatus !== 'running' && row.procStatus !== 'starting'
  const canStop  = row.procStatus === 'running' || row.procStatus === 'stopping'

  return (
    <div className="px-5 py-4 space-y-3">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <span className="font-medium text-slate-200">{meta.label}</span>
          {/* Transport mode badge */}
          <span className={`text-xs px-1.5 py-0.5 rounded border ${isStdio ? 'text-sky-400 border-sky-500/30 bg-sky-500/10' : 'text-slate-400 border-slate-600 bg-slate-700/40'}`}>
            {isStdio ? 'stdio' : 'SSE'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Only show process status badge in stdio mode */}
          {isStdio && <ProcBadge status={row.procStatus} />}
          {/* Enable toggle */}
          <button
            onClick={() => onChange({ enabled: !row.enabled })}
            className={`relative w-9 h-5 rounded-full transition-colors ${row.enabled ? 'bg-indigo-600' : 'bg-slate-600'}`}
            title={row.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${row.enabled ? 'translate-x-4' : ''}`} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-2">
        {/* URL only shown in SSE mode, or as optional override in stdio mode */}
        <div className="space-y-0.5">
          <Field
            label="SSE URL"
            value={row.url}
            placeholder={isStdio ? 'optional — leave empty for stdio mode' : 'http://localhost:3101'}
            onChange={(v) => onChange({ url: v })}
          />
          {isStdio && !hasUrl && (
            <p className="text-xs text-sky-500/80 pl-24">
              Stdio mode active — app spawns the process directly per query.
            </p>
          )}
        </div>
        {meta.hasSchema   && <Field label="Schema"   value={row.schema}   placeholder="dbo"   onChange={(v) => onChange({ schema: v })} />}
        {meta.hasDatabase && <Field label="Database" value={row.database} placeholder="mydb"  onChange={(v) => onChange({ database: v })} />}
        <Field
          label="Conn URI"
          value={row.uri}
          placeholder={
            dbKey === 'mongodb'   ? 'mongodb://localhost:27017' :
            dbKey === 'postgres'  ? 'postgresql://user:pass@localhost:5432/db' :
            dbKey === 'mysql'     ? 'mysql://user:pass@localhost:3306/db' :
                                    'Server=localhost;Database=db;User=sa;'
          }
          onChange={(v) => onChange({ uri: v })}
        />
        <ExecPathField value={row.execPath} onChange={(v) => onChange({ execPath: v })} />
        {hasExec && (
          <Field label="Start Cmd" value={row.startCommand} placeholder="node dist/index.js  or  npm start" onChange={(v) => onChange({ startCommand: v })} />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* Test — works in both modes */}
        <button
          onClick={onTest}
          disabled={!canTest || row.testStatus === 'testing'}
          className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 transition-colors"
        >
          {row.testStatus === 'testing' ? '⟳ Testing…' : '⚡ Test Connection'}
        </button>

        {/* Start / Stop / Logs — stdio only (SSE servers manage their own lifecycle) */}
        {hasExec && (
          <>
            <button
              onClick={onStart}
              disabled={!canStart}
              className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-colors"
            >
              {row.procStatus === 'starting' ? '⟳ Starting…' : '▶ Start'}
            </button>
            <button
              onClick={onStop}
              disabled={!canStop}
              className="px-3 py-1.5 text-xs rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white transition-colors"
            >
              {row.procStatus === 'stopping' ? '⟳ Stopping…' : '■ Stop'}
            </button>
            <button
              onClick={row.logsOpen ? onCloseLogs : onLoadLogs}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              {row.logsOpen ? '▲ Logs' : '▼ Logs'}
            </button>
          </>
        )}

        {/* Save */}
        <button
          onClick={onSave}
          disabled={row.saving}
          className="ml-auto px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors font-medium"
        >
          {row.saving ? '⟳ Saving…' : '✓ Save'}
        </button>
      </div>

      {/* Test result */}
      <TestResult status={row.testStatus} latency={row.testLatency} error={row.testError} />

      {/* Process logs */}
      {row.logsOpen && (
        <div className="mt-2 bg-slate-950 rounded-lg border border-slate-700 p-3 max-h-36 overflow-y-auto font-mono text-xs text-slate-300 space-y-0.5">
          {row.logs.length === 0
            ? <span className="text-slate-500 italic">No logs yet</span>
            : row.logs.map((l, i) => <div key={i} className="leading-relaxed">{l}</div>)
          }
        </div>
      )}
    </div>
  )
}

// ── Small helper components ──────────────────────────────────────────────
function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-20 flex-shrink-0 text-right">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-slate-800 border border-slate-600 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors"
      />
    </div>
  )
}

function ProcBadge({ status }: { status: ProcStatus }) {
  const map: Record<ProcStatus, { dot: string; label: string }> = {
    running:  { dot: 'bg-emerald-400 animate-pulse', label: 'Running'  },
    stopped:  { dot: 'bg-slate-500',                 label: 'Stopped'  },
    error:    { dot: 'bg-red-400',                   label: 'Error'    },
    starting: { dot: 'bg-yellow-400 animate-pulse',  label: 'Starting' },
    stopping: { dot: 'bg-orange-400 animate-pulse',  label: 'Stopping' },
  }
  const { dot, label } = map[status] ?? map.stopped
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

function TestResult({ status, latency, error }: { status: TestStatus; latency?: number; error?: string }) {
  if (status === 'idle') return null
  if (status === 'testing') return <p className="text-xs text-slate-400 animate-pulse">Testing connection…</p>
  if (status === 'ok') return (
    <p className="text-xs text-emerald-400">✓ Connected{latency !== undefined ? ` · ${latency}ms` : ''}</p>
  )
  return <p className="text-xs text-red-400">✕ {error ?? 'Connection failed'}</p>
}

// ── ExecPathField: text input + folder browse button ────────────────────
function ExecPathField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400 w-20 flex-shrink-0 text-right">Exec Path</span>
        <div className="flex flex-1 gap-1.5">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/path/to/mcp-server  (optional)"
            className="flex-1 bg-slate-800 border border-slate-600 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors min-w-0"
          />
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            title="Browse folder"
            className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs transition-colors"
          >
            📁
          </button>
        </div>
      </div>
      {pickerOpen && (
        <FolderPicker
          initial={value || undefined}
          onSelect={(path) => { onChange(path); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  )
}

// ── FolderPicker: filesystem navigation overlay ──────────────────────────
function FolderPicker({
  initial,
  onSelect,
  onClose,
}: {
  initial?: string
  onSelect: (path: string) => void
  onClose: () => void
}) {
  const [result, setResult] = useState<BrowseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualPath, setManualPath] = useState('')

  const navigate = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/settings/browse?path=${encodeURIComponent(path)}`)
      if (!res.ok) { setError('Cannot read directory'); return }
      const data = await res.json() as BrowseResult
      setResult(data)
      setManualPath(data.path)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    navigate(initial || '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const dirs = result?.entries.filter((e) => e.isDir) ?? []

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md flex flex-col bg-slate-900 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden max-h-[70vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
          <span className="text-sm font-medium text-slate-200">Browse Folder</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100 transition-colors px-1">✕</button>
        </div>

        {/* Path bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 border-b border-slate-700 flex-shrink-0">
          <button
            onClick={() => result?.parent && navigate(result.parent)}
            disabled={!result?.parent || loading}
            className="flex-shrink-0 p-1 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-400 hover:text-slate-200 transition-colors text-sm"
            title="Go up"
          >
            ↑
          </button>
          <input
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(manualPath)}
            className="flex-1 bg-transparent text-xs text-slate-300 outline-none placeholder-slate-500 min-w-0"
            placeholder="Type a path and press Enter…"
          />
          {loading && <span className="text-xs text-slate-500 animate-pulse flex-shrink-0">Loading…</span>}
        </div>

        {/* Directory list */}
        <div className="flex-1 overflow-y-auto py-1">
          {error ? (
            <div className="px-4 py-6 text-center text-xs text-red-400">{error}</div>
          ) : dirs.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center text-xs text-slate-500 italic">No subdirectories</div>
          ) : (
            <ul>
              {dirs.map((entry) => (
                <li key={entry.path}>
                  <button
                    onClick={() => navigate(entry.path)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white transition-colors text-left"
                  >
                    <span className="text-base leading-none flex-shrink-0">📁</span>
                    <span className="font-mono truncate">{entry.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-700 bg-slate-800/60 flex-shrink-0">
          <span className="flex-1 text-xs text-slate-400 truncate">{result?.path ?? '…'}</span>
          <button
            onClick={() => result && onSelect(result.path)}
            disabled={!result}
            className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors font-medium"
          >
            Select this folder
          </button>
        </div>
      </div>
    </div>
  )
}
