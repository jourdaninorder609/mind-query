import { spawn, type ChildProcess } from 'child_process'

export type ProcessStatus = 'running' | 'stopped' | 'error'

interface ProcessEntry {
  process: ChildProcess
  startedAt: Date
  logs: string[]
  status: ProcessStatus
}

// Persist across Next.js hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __mcpProcesses: Map<string, ProcessEntry> | undefined
}

const store: Map<string, ProcessEntry> =
  globalThis.__mcpProcesses ?? (globalThis.__mcpProcesses = new Map())

export function startProcess(key: string, execPath: string, command: string): void {
  if (store.has(key)) return

  const [cmd, ...args] = command.split(' ')
  const child = spawn(cmd, args, {
    cwd: execPath,
    // stdin must be 'pipe' (not 'ignore') so stdio-transport MCP servers
    // don't receive EOF immediately and exit.
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })

  const entry: ProcessEntry = { process: child, startedAt: new Date(), logs: [], status: 'running' }
  store.set(key, entry)

  const push = (line: string) => {
    entry.logs.push(line.trimEnd())
    if (entry.logs.length > 200) entry.logs.splice(0, 50)
  }

  child.stdout?.on('data', (d: Buffer) => push(d.toString()))
  child.stderr?.on('data', (d: Buffer) => push('[stderr] ' + d.toString()))

  child.on('exit', (code) => {
    const e = store.get(key)
    if (e) e.status = code === 0 ? 'stopped' : 'error'
    // Keep entry for logs; clean up after 30 s
    setTimeout(() => store.delete(key), 30_000)
  })

  child.on('error', (err) => {
    const e = store.get(key)
    if (e) { e.status = 'error'; e.logs.push('[error] ' + err.message) }
  })
}

export function stopProcess(key: string): void {
  const entry = store.get(key)
  if (!entry) return
  entry.process.kill('SIGTERM')
  entry.status = 'stopped'
  store.delete(key)
}

export function getStatus(key: string): ProcessStatus {
  const entry = store.get(key)
  if (!entry) return 'stopped'
  return entry.status
}

export function getAllStatuses(): Record<string, ProcessStatus> {
  const keys = ['postgres', 'mysql', 'sqlserver', 'mongodb']
  return Object.fromEntries(keys.map((k) => [k, getStatus(k)]))
}

export function getLogs(key: string): string[] {
  return store.get(key)?.logs ?? []
}
