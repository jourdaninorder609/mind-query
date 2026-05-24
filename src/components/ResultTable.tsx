'use client'
import { useState } from 'react'

interface Props {
  data: Record<string, unknown>[]
  maskedFields?: string[]
}

export function ResultTable({ data, maskedFields = [] }: Props) {
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20
  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  const slice = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (data.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-400 text-sm italic">
        <span>○</span> Không tìm thấy dữ liệu
      </div>
    )
  }

  const headers = Object.keys(data[0])

  function formatValue(val: unknown): string {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  function exportCsv() {
    const rows = [headers.join(','), ...data.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'result.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mt-2">
      {maskedFields.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-400">
          <span>🔒</span>
          <span>Trường ẩn (PII): {maskedFields.join(', ')}</span>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700">
              {headers.map((h) => (
                <th
                  key={h}
                  className={`px-3 py-2 text-left font-medium text-xs uppercase tracking-wide whitespace-nowrap ${
                    maskedFields.includes(h) ? 'text-amber-400' : 'text-slate-300'
                  }`}
                >
                  {h}
                  {maskedFields.includes(h) && ' 🔒'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${
                  i % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-900/30'
                }`}
              >
                {headers.map((h) => {
                  const val = formatValue(row[h])
                  return (
                    <td
                      key={h}
                      className="px-3 py-2 text-slate-300 max-w-xs truncate"
                      title={val}
                    >
                      {val}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>{data.length} dòng</span>
          <button
            onClick={exportCsv}
            className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
          >
            ↓ CSV
          </button>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-0.5 rounded hover:bg-slate-700 disabled:opacity-30">‹</button>
            <span>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="px-2 py-0.5 rounded hover:bg-slate-700 disabled:opacity-30">›</button>
          </div>
        )}
      </div>
    </div>
  )
}
