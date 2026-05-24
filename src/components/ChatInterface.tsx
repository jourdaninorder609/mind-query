'use client'
import { useEffect, useRef, useState, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import { Header } from './Header'
import { SchemaSidebar } from './SchemaSidebar'
import { MessageBubble, TypingIndicator, type Message } from './MessageBubble'
import type { DbType } from '@/lib/container'
import type { QueryResponse } from '@/types/api'

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Xin chào! Tôi là Mind Query Agent. Hãy đặt câu hỏi bằng tiếng Việt hoặc tiếng Anh về dữ liệu của bạn.',
  result: undefined,
  timestamp: new Date(),
}

const QUICK_PROMPTS = [
  'Cho tôi xem 10 bản ghi mới nhất',
  'Tổng số bản ghi trong mỗi bảng?',
  'Thống kê theo thành phố',
  'Top 5 sản phẩm bán chạy nhất',
]

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeDb, setActiveDb] = useState<DbType>('demo')
  const [availableDbs, setAvailableDbs] = useState<DbType[]>(['demo'])
  const [tables, setTables] = useState<string[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load available DBs on mount
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d: { available: DbType[] }) => setAvailableDbs(d.available ?? ['demo']))
      .catch(() => {})
  }, [])

  // Load schema when DB changes
  useEffect(() => {
    setTables([])
    fetch(`/api/schema?dbType=${activeDb}`)
      .then((r) => r.json())
      .then((d: { tables: string[] }) => setTables(d.tables ?? []))
      .catch(() => {})
  }, [activeDb])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || isLoading) return

      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        content: prompt.trim(),
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setIsLoading(true)

      try {
        const res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: prompt.trim(), dbType: activeDb }),
        })
        const data = (await res.json()) as QueryResponse

        if (!data.success && 'blocked' in data && data.blocked) {
          setMessages((prev) => [
            ...prev,
            { id: generateId(), role: 'error', content: data.error, result: data, timestamp: new Date() },
          ])
        } else if (!data.success) {
          const err = data as { success: false; error: string }
          setMessages((prev) => [
            ...prev,
            { id: generateId(), role: 'error', content: err.error ?? 'Đã có lỗi xảy ra', timestamp: new Date() },
          ])
        } else {
          setMessages((prev) => [
            ...prev,
            { id: generateId(), role: 'assistant', content: '', result: data, timestamp: new Date() },
          ])
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: generateId(), role: 'error', content: 'Không thể kết nối đến server. Vui lòng thử lại.', timestamp: new Date() },
        ])
      } finally {
        setIsLoading(false)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    },
    [activeDb, isLoading]
  )

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function handleDbChange(db: DbType) {
    setActiveDb(db)
    setMessages([WELCOME])
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      <Header
        available={availableDbs}
        activeDb={activeDb}
        onDbChange={handleDbChange}
        onClearHistory={() => setMessages([WELCOME])}
      />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className={`flex-shrink-0 bg-slate-800/60 border-r border-slate-700 transition-all duration-200 ${
            sidebarOpen ? 'w-56' : 'w-0 overflow-hidden'
          }`}
        >
          <SchemaSidebar
            tables={tables}
            dbType={activeDb}
            onQuerySuggestion={(p) => sendMessage(p)}
          />
        </aside>

        {/* Toggle sidebar button */}
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="absolute left-0 top-1/2 -translate-y-1/2 ml-0.5 z-20 w-4 h-10 bg-slate-700 hover:bg-slate-600 rounded-r text-slate-400 hover:text-slate-200 flex items-center justify-center text-xs transition-colors"
          style={{ marginLeft: sidebarOpen ? '14rem' : '0' }}
          title={sidebarOpen ? 'Ẩn sidebar' : 'Hiện sidebar'}
        >
          {sidebarOpen ? '‹' : '›'}
        </button>

        {/* Main chat area */}
        <main className="flex flex-col flex-1 min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {/* Quick prompts (shown only at start) */}
            {messages.length === 1 && (
              <div className="fade-in max-w-2xl mx-auto pt-4">
                <p className="text-center text-slate-400 text-sm mb-4">Bắt đầu với một câu hỏi hoặc thử gợi ý sau:</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="text-left text-sm px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="max-w-4xl mx-auto w-full">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {isLoading && <TypingIndicator />}
            </div>
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-slate-700 bg-slate-900 px-4 py-3">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              <div className="flex items-end gap-2 bg-slate-800 border border-slate-600 focus-within:border-indigo-500/70 rounded-2xl px-4 py-2.5 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  placeholder="Nhập câu hỏi bằng tiếng Việt hoặc tiếng Anh… (Enter để gửi, Shift+Enter xuống dòng)"
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none outline-none leading-relaxed max-h-32 overflow-y-auto disabled:opacity-50"
                  style={{ scrollbarWidth: 'none' }}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  title="Gửi (Enter)"
                >
                  {isLoading ? (
                    <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 text-center">
                Chỉ được phép đọc dữ liệu • Mọi yêu cầu được kiểm tra bảo mật trước khi thực thi
              </p>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}
