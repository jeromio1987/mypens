import { NextResponse } from 'next/server'

/**
 * Public readiness check — no secrets returned.
 * Use after editing `.env` or before testing Expo → Next.
 */
export async function GET() {
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim())
  const hasMobileToken = Boolean(process.env.MOBILE_PENS_API_TOKEN?.trim())
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim())

  return NextResponse.json({
    ok: true,
    server: 'my-pens',
    env: {
      hasAnthropicKey,
      hasMobileToken,
      hasDatabaseUrl,
    },
  })
}
