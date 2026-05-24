import { NextRequest, NextResponse } from 'next/server'
import { readSettings, writeSettings, type AppSettings } from '@/lib/settings'

export async function GET() {
  return NextResponse.json(readSettings())
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AppSettings
    writeSettings(body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
