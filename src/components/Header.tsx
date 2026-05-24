'use client'
import type { DbType } from '@/lib/container'
import { DbSelector } from './DbSelector'

interface Props {
  available: DbType[]
  activeDb: DbType
  onDbChange: (db: DbType) => void
  onClearHistory: () => void
}

export function Header({ available, activeDb, onDbChange, onClearHistory }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">M</div>
          <span className="font-semibold text-slate-100 hidden sm:block">mind-query</span>
        </div>
        <div className="w-px h-5 bg-slate-700"></div>
        <DbSelector available={available} active={activeDb} onChange={onDbChange} />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onClearHistory}
          title="Xóa lịch sử chat"
          className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
        >
          Xóa chat
        </button>
        <a
          href="https://github.com/az-coder-123"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-slate-200 transition-colors text-sm px-1"
          title="GitHub"
        >
          ⌥
        </a>
      </div>
    </header>
  )
}
