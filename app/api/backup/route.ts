import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { cookies } from 'next/headers'
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth'

async function requireAuth(): Promise<NextResponse | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  const ok = await verifySessionToken(token)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}

export async function POST() {
  const authError = await requireAuth()
  if (authError) return authError
  try {
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
    const backupDir = path.join(process.cwd(), 'prisma', 'backups')

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Database file not found' }, { status: 404 })
    }

    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupFilename = `dev_${timestamp}.db`
    const backupPath = path.join(backupDir, backupFilename)

    fs.copyFileSync(dbPath, backupPath)

    // Keep only the 10 most recent backups to avoid filling disk
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.db'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time)

    if (files.length > 10) {
      files.slice(10).forEach(f => fs.unlinkSync(path.join(backupDir, f.name)))
    }

    const stats = fs.statSync(backupPath)
    const sizeKb = Math.round(stats.size / 1024)

    return NextResponse.json({
      filename: backupFilename,
      path: `prisma/backups/${backupFilename}`,
      sizeKb,
      timestamp: now.toISOString(),
      backupsKept: Math.min(files.length, 10),
    })
  } catch (error) {
    console.error('Backup failed:', error)
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 })
  }
}

export async function GET() {
  const authError = await requireAuth()
  if (authError) return authError
  try {
    const backupDir = path.join(process.cwd(), 'prisma', 'backups')

    if (!fs.existsSync(backupDir)) {
      return NextResponse.json({ backups: [] })
    }

    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const stat = fs.statSync(path.join(backupDir, f))
        return {
          filename: f,
          sizeKb: Math.round(stat.size / 1024),
          createdAt: stat.mtime.toISOString(),
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    return NextResponse.json({ backups: files })
  } catch (error) {
    console.error('Failed to list backups:', error)
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 })
  }
}
