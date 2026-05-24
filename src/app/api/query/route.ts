import { NextRequest, NextResponse } from 'next/server'
import { createPipeline, type DbType } from '@/lib/container'
import { SecurityViolationError } from '@/application/pipeline/QueryPipeline'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const prompt: unknown = body?.prompt
    const dbType: unknown = body?.dbType ?? 'demo'

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Prompt không được để trống' }, { status: 400 })
    }
    if (prompt.length > 2000) {
      return NextResponse.json({ success: false, error: 'Prompt quá dài (tối đa 2000 ký tự)' }, { status: 400 })
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
      dialect: pipeline['executor' as keyof typeof pipeline],
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
    const msg = err instanceof Error ? err.message : 'Lỗi không xác định'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
