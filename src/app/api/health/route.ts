import { NextResponse } from 'next/server'
import { getAvailableDbTypes } from '@/lib/container'

export async function GET() {
  return NextResponse.json({ available: getAvailableDbTypes() })
}
