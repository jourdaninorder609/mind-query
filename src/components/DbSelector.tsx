'use client'
import type { DbType } from '@/lib/container'

const DB_META: Record<DbType, { label: string; icon: string; color: string }> = {
  demo:      { label: 'Demo',       icon: '◈', color: '#6366f1' },
  postgres:  { label: 'PostgreSQL', icon: '🐘', color: '#336791' },
  mysql:     { label: 'MySQL',      icon: '🐬', color: '#f29111' },
  sqlserver: { label: 'SQL Server', icon: '🪟', color: '#cc2927' },
  mongodb:   { label: 'MongoDB',    icon: '🍃', color: '#10aa50' },
}

interface Props {
  available: DbType[]
  active: DbType
  onChange: (db: DbType) => void
}

export function DbSelector({ available, active, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {available.map((db) => {
        const meta = DB_META[db]
        const isActive = db === active
        return (
          <button
            key={db}
            onClick={() => onChange(db)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              isActive
                ? 'text-white shadow-lg'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
            style={isActive ? { backgroundColor: meta.color + '33', borderColor: meta.color, border: '1px solid', color: meta.color } : {}}
          >
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-current ml-0.5 opacity-80"></span>}
          </button>
        )
      })}
    </div>
  )
}
