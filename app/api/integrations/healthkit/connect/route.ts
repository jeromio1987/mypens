import { NextResponse } from 'next/server'
import { issuePairingToken } from '@/lib/integrations/healthkit/auth'
import { requireOwner } from '@/lib/integrations/requireOwner'

/** POST { deviceLabel? } — mint (or rotate) the pairing token shown to the user. */
export async function POST(request: Request) {
  const authError = await requireOwner()
  if (authError) return authError

  try {
    const body = await request.json().catch(() => ({}))
    const deviceLabel: string | null =
      typeof body?.deviceLabel === 'string' ? body.deviceLabel.slice(0, 80) : null
    const conn = await issuePairingToken(deviceLabel)
    return NextResponse.json({
      ok: true,
      pairingToken: conn.pairingToken,
      deviceLabel: conn.deviceLabel,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to issue pairing token' }, { status: 500 })
  }
}
