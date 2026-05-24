import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'mind-query — AI Data Agent',
  description: 'Hỏi dữ liệu bằng ngôn ngữ tự nhiên, kết nối đa cơ sở dữ liệu qua MCP',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="dark h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
