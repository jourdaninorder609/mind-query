import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'mind-query — AI Data Agent',
  description: 'Ask questions about your data in natural language, connected to multiple databases via MCP',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
