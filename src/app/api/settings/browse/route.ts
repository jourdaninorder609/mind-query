import { NextRequest, NextResponse } from 'next/server'
import { readdirSync, statSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { homedir } from 'os'

export interface BrowseEntry {
  name: string
  isDir: boolean
  path: string
}

export interface BrowseResult {
  path: string
  parent: string | null
  entries: BrowseEntry[]
}

export async function GET(req: NextRequest) {
  const rawPath = req.nextUrl.searchParams.get('path') || homedir()
  const safePath = resolve(rawPath)

  try {
    const names = readdirSync(safePath, { withFileTypes: true })
    const entries: BrowseEntry[] = names
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => {
        const fullPath = join(safePath, e.name)
        try {
          const stat = statSync(fullPath)
          return { name: e.name, isDir: stat.isDirectory(), path: fullPath }
        } catch {
          return null
        }
      })
      .filter((e): e is BrowseEntry => e !== null)
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })

    const parent = dirname(safePath)
    return NextResponse.json<BrowseResult>({
      path: safePath,
      parent: parent !== safePath ? parent : null,
      entries,
    })
  } catch {
    return NextResponse.json({ error: 'Cannot read directory' }, { status: 400 })
  }
}
