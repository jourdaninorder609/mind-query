import type { IAuditLogger, AuditEvent } from '@/core/interfaces/IAuditLogger'
import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'

export class FileAuditLogger implements IAuditLogger {
  private readonly logPath: string

  constructor(logDir = 'logs') {
    this.logPath = join(process.cwd(), logDir, 'audit.jsonl')
  }

  async log(event: AuditEvent): Promise<void> {
    try {
      await mkdir(join(process.cwd(), 'logs'), { recursive: true })
      const line = JSON.stringify({ ...event, timestamp: event.timestamp.toISOString() }) + '\n'
      await appendFile(this.logPath, line, 'utf-8')
    } catch {
      // Audit failure must never block the user-facing flow
    }
  }
}
