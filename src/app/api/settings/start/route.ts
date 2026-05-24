import { NextRequest, NextResponse } from 'next/server'
import { startProcess, getStatus } from '@/lib/processManager'

export async function POST(req: NextRequest) {
  const { key, execPath, startCommand } = await req.json() as {
    key: string; execPath: string; startCommand: string
  }

  if (!execPath?.trim()) {
    return NextResponse.json({ ok: false, error: 'Exec path is not configured' }, { status: 400 })
  }
  if (getStatus(key) === 'running') {
    return NextResponse.json({ ok: true, status: 'running' })
  }

  try {
    startProcess(key, execPath.trim(), startCommand?.trim() || 'npm start')
    // Give the process 500ms to fail fast (bad path, missing node_modules, etc.)
    await new Promise((r) => setTimeout(r, 500))
    const status = getStatus(key)
    return NextResponse.json({ ok: true, status })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Start failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
