'use client'
import { useState } from 'react'

const KEYWORDS = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|LIKE|AS|BY|GROUP|ORDER|HAVING|LIMIT|OFFSET|DISTINCT|COUNT|SUM|AVG|MIN|MAX|NULL|IS|DESC|ASC|TOP|CASE|WHEN|THEN|ELSE|END|UNION|WITH|EXISTS)\b/gi

function tokenize(sql: string) {
  const tokens: { type: string; value: string }[] = []
  const re = /('(?:[^'\\]|\\.)*')|(\b(?:SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|LIKE|AS|BY|GROUP|ORDER|HAVING|LIMIT|OFFSET|DISTINCT|COUNT|SUM|AVG|MIN|MAX|NULL|IS|DESC|ASC|TOP|CASE|WHEN|THEN|ELSE|END|UNION|WITH|EXISTS)\b)|(\b\d+(?:\.\d+)?\b)|(--[^\n]*)|(\/\*[\s\S]*?\*\/)|(\n)|([^\s']+)|(\s+)/gi
  let m
  while ((m = re.exec(sql)) !== null) {
    if (m[1]) tokens.push({ type: 'string', value: m[1] })
    else if (m[2]) tokens.push({ type: 'keyword', value: m[2] })
    else if (m[3]) tokens.push({ type: 'number', value: m[3] })
    else if (m[4] || m[5]) tokens.push({ type: 'comment', value: m[4] ?? m[5] })
    else if (m[6]) tokens.push({ type: 'newline', value: '\n' })
    else tokens.push({ type: 'default', value: m[0] })
  }
  return tokens
}

const COLOR: Record<string, string> = {
  keyword: 'text-sky-400 font-semibold',
  string:  'text-emerald-400',
  number:  'text-amber-400',
  comment: 'text-slate-500 italic',
  default: 'text-slate-200',
}

export function SqlBlock({ query, dialect }: { query: string; dialect?: string }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const isJson = query.trim().startsWith('{')
  const tokens = isJson ? [] : tokenize(query)

  async function copy() {
    await navigator.clipboard.writeText(query)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">
            {dialect === 'MongoDB' ? 'MQL Query' : 'SQL'}
          </span>
          {dialect && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{dialect}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            {expanded ? '▲ Thu gọn' : '▼ Mở rộng'}
          </button>
          <button
            onClick={copy}
            className="text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
          >
            {copied ? '✓ Đã sao chép' : 'Sao chép'}
          </button>
        </div>
      </div>
      <pre
        className={`text-sm p-3 bg-slate-950 overflow-x-auto font-mono leading-relaxed transition-all ${
          expanded ? '' : 'max-h-32 overflow-y-hidden'
        }`}
      >
        {isJson
          ? <span className="text-slate-200">{JSON.stringify(JSON.parse(query), null, 2)}</span>
          : tokens.map((t, i) =>
              t.type === 'newline'
                ? <br key={i} />
                : <span key={i} className={COLOR[t.type] ?? COLOR.default}>{t.value}</span>
            )
        }
      </pre>
    </div>
  )
}
