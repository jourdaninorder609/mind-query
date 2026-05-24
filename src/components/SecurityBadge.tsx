import type { SecurityReport } from '@/core/entities/SecurityReport'

interface Props {
  report: SecurityReport
  compact?: boolean
}

export function SecurityBadge({ report, compact }: Props) {
  const { riskScore, isSafe } = report
  const color = isSafe
    ? riskScore < 20 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30'

  const icon = isSafe ? '✓' : '✕'
  const label = isSafe
    ? riskScore < 20 ? 'An toàn' : 'Chú ý'
    : 'Bị chặn'

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${color}`}>
        {icon} {label} ({riskScore})
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${color}`}>
      <span className="font-bold">{icon} Bảo mật: {label}</span>
      <span>Điểm rủi ro: {riskScore}/100</span>
      {report.detectedPatterns.length > 0 && (
        <span>• {report.detectedPatterns.join(', ')}</span>
      )}
    </div>
  )
}
