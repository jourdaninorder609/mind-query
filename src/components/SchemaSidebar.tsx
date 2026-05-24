'use client'
import { useState } from 'react'
import type { DbType } from '@/lib/container'

interface Props {
  tables: string[]
  dbType: DbType
  onQuerySuggestion: (prompt: string) => void
}

const SUGGESTIONS = [
  'Show me the 10 most recent records',
  'Count total records',
  'Show statistics by group',
]

export function SchemaSidebar({ tables, dbType, onQuerySuggestion }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(table: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(table) ? next.delete(table) : next.add(table)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-700">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {dbType === 'mongodb' ? 'Collections' : 'Tables'} ({tables.length})
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {tables.length === 0 ? (
          <div className="px-4 py-3 text-xs text-slate-500 italic">
            No tables found — check MCP connection
          </div>
        ) : (
          <ul>
            {tables.map((table) => (
              <li key={table}>
                <button
                  onClick={() => toggle(table)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors text-left"
                >
                  <span className="text-indigo-400 text-xs">{expanded.has(table) ? '▼' : '▶'}</span>
                  <span className="font-mono">{table}</span>
                </button>
                {expanded.has(table) && (
                  <div className="ml-6 border-l border-slate-700 pl-3 py-1">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => onQuerySuggestion(`${s} in the ${table} table`)}
                        className="w-full text-left text-xs text-slate-400 hover:text-indigo-400 py-0.5 transition-colors"
                      >
                        → {s}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-700">
        <p className="text-xs text-slate-500">Click a table to see query suggestions</p>
      </div>
    </div>
  )
}
