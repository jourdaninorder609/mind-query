import { NextRequest, NextResponse } from 'next/server'
import { getAllStatuses, getLogs } from '@/lib/processManager'

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('logs')
  if (key) {
    return NextResponse.json({ logs: getLogs(key) })
  }
  return NextResponse.json(getAllStatuses())
}
