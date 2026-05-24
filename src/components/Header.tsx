'use client'
import type { DbType } from '@/lib/container'
import { DbSelector } from './DbSelector'

interface Props {
  available: DbType[]
  activeDb: DbType
  onDbChange: (db: DbType) => void
  onClearHistory: () => void
  onOpenSettings: () => void
}

export function Header({ available, activeDb, onDbChange, onClearHistory, onOpenSettings }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">M</div>
          <span className="font-semibold text-slate-100 hidden sm:block">mind-query</span>
        </div>
        <div className="w-px h-5 bg-slate-700" />
        <DbSelector available={available} active={activeDb} onChange={onDbChange} />
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onClearHistory}
          title="Clear chat history"
          className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={onOpenSettings}
          title="MCP server settings"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </button>
      </div>
    </header>
  )
}
