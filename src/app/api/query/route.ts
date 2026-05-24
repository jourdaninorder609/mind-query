import { NextRequest, NextResponse } from 'next/server'
import { createPipeline, type DbType } from '@/lib/container'
import { SecurityViolationError } from '@/application/pipeline/QueryPipeline'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const prompt: unknown = body?.prompt
    const dbType: unknown = body?.dbType ?? 'demo'

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 })
    }
    if (prompt.length > 2000) {
      return NextResponse.json({ success: false, error: 'Prompt too long (max 2000 characters)' }, { status: 400 })
    }

    const pipeline = createPipeline(dbType as DbType)
    const result = await pipeline.run(prompt.trim())

    return NextResponse.json({
      success: true,
      securityReport: result.securityReport,
      query: result.queryResult.query,
      data: result.filteredResult.data,
      rowCount: result.filteredResult.rowCount,
      maskedFields: result.filteredResult.maskedFields,
      executionTimeMs: result.queryResult.executionTimeMs,
      tablesAccessed: result.queryResult.tablesAccessed,
      dialect: pipeline.getDialect(),
    })
  } catch (err) {
    if (err instanceof SecurityViolationError) {
      return NextResponse.json({
        success: false,
        blocked: true,
        riskScore: err.riskScore,
        detectedPatterns: err.detectedPatterns,
        error: err.message,
      }, { status: 403 })
    }
    const raw = err instanceof Error ? err.message : 'Unknown error'
    const msg = raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
