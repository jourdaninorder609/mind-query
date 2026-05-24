import { NextRequest, NextResponse } from 'next/server'
import { stopProcess } from '@/lib/processManager'

export async function POST(req: NextRequest) {
  const { key } = await req.json() as { key: string }
  stopProcess(key)
  return NextResponse.json({ ok: true, status: 'stopped' })
}
