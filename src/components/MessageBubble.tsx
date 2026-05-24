'use client'
import { SecurityBadge } from './SecurityBadge'
import { ResultTable } from './ResultTable'
import { SqlBlock } from './SqlBlock'
import type { QueryResponse } from '@/types/api'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  result?: QueryResponse
  timestamp: Date
}

interface Props {
  message: Message
}

export function MessageBubble({ message }: Props) {
  const { role, content, result, timestamp } = message
  const time = timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  if (role === 'user') {
    return (
      <div className="fade-in flex justify-end mb-4">
        <div className="max-w-[75%]">
          <div className="bg-indigo-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed">
            {content}
          </div>
          <div className="text-right text-xs text-slate-500 mt-1 mr-1">{time}</div>
        </div>
      </div>
    )
  }

  if (role === 'error') {
    const blocked = result && 'blocked' in result && result.blocked
    return (
      <div className="fade-in flex mb-4">
        <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-xs mr-2.5 mt-0.5 flex-shrink-0">✕</div>
        <div className="max-w-[80%]">
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-2xl rounded-tl-sm text-sm">
            {blocked && result && 'riskScore' in result && (
              <div className="font-semibold mb-1 flex items-center gap-2">
                <span>🚫 Yêu cầu bị chặn</span>
                <span className="text-xs bg-red-500/20 px-2 py-0.5 rounded-full">Điểm rủi ro: {result.riskScore}/100</span>
              </div>
            )}
            <p>{content}</p>
            {result && 'detectedPatterns' in result && result.detectedPatterns?.length > 0 && (
              <p className="mt-1 text-xs text-red-400/70">Phát hiện: {result.detectedPatterns.join(', ')}</p>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1 ml-1">{time}</div>
        </div>
      </div>
    )
  }

  // Assistant message
  const success = result && result.success
  const successResult = success ? (result as Extract<QueryResponse, { success: true }>) : null

  return (
    <div className="fade-in flex mb-4">
      <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs mr-2.5 mt-0.5 flex-shrink-0">AI</div>
      <div className="max-w-[85%] flex-1">
        <div className="bg-slate-800 border border-slate-700 px-4 py-3 rounded-2xl rounded-tl-sm">
          {successResult ? (
            <>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="text-sm text-slate-200 font-medium">
                  Tìm thấy <span className="text-indigo-400">{successResult.rowCount}</span> kết quả
                  {successResult.tablesAccessed.length > 0 && (
                    <span className="text-slate-400 text-xs ml-2">
                      từ {successResult.tablesAccessed.join(', ')}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{successResult.executionTimeMs}ms</span>
                  <SecurityBadge report={successResult.securityReport} compact />
                </div>
              </div>
              <ResultTable data={successResult.data} maskedFields={successResult.maskedFields} />
              <SqlBlock query={successResult.query} dialect={successResult.dialect as string | undefined} />
            </>
          ) : (
            <p className="text-sm text-slate-300">{content}</p>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-1 ml-1">{time}</div>
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="fade-in flex mb-4">
      <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs mr-2.5 mt-0.5 flex-shrink-0">AI</div>
      <div className="bg-slate-800 border border-slate-700 px-4 py-3.5 rounded-2xl rounded-tl-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 typing-dot"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 typing-dot"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 typing-dot"></span>
        </div>
      </div>
    </div>
  )
}
