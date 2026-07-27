import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Public readiness check — no secrets returned.
 * Use after editing `.env` or before testing Expo → Next.
 * Optional `dbOk`: fast SELECT 1 with short timeout so a wedged Prisma
 * does not hang the probe; env.hasDatabaseUrl can still be true when dbOk is false.
 */
export async function GET() {
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim())
  const hasMobileToken = Boolean(process.env.MOBILE_PENS_API_TOKEN?.trim())
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim())

  let dbOk: boolean | null = null
  let dbMs: number | null = null
  if (hasDatabaseUrl) {
    const started = Date.now()
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('db_timeout')), 1500)
        }),
      ])
      dbOk = true
      dbMs = Date.now() - started
    } catch {
      dbOk = false
      dbMs = Date.now() - started
    }
  }

  return NextResponse.json({
    ok: true,
    server: 'my-pens',
    env: {
      hasAnthropicKey,
      hasMobileToken,
      hasDatabaseUrl,
    },
    dbOk,
    dbMs,
  })
}
