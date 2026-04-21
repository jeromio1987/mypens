import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'

const STRAVA_PUSH_URL = 'https://www.strava.com/api/v3/push_subscriptions'

interface StravaSubscription {
  id: number
  callback_url: string
  resource_state?: number
  created_at?: string
  updated_at?: string
}

function assertCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('STRAVA_NOT_CONFIGURED')
  return { clientId, clientSecret }
}

export async function listSubscriptions(): Promise<StravaSubscription[]> {
  const { clientId, clientSecret } = assertCreds()
  const url = `${STRAVA_PUSH_URL}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava listSubscriptions failed: ${res.status} ${text}`)
  }
  return (await res.json()) as StravaSubscription[]
}

/**
 * Subscribe the app's webhook callback. Strava only allows ONE active
 * subscription per app, so if one already exists with the same callback URL
 * we reuse it; otherwise stale ones are deleted and a fresh subscription is
 * created.
 *
 * IMPORTANT: the verify_token is persisted to `StravaConnection.webhookVerifyToken`
 * BEFORE we call Strava's subscribe endpoint, because Strava performs a GET
 * handshake to our callback during subscribe — our handler validates the
 * incoming token by reading it from the DB. If we persisted the token after
 * the call, the handshake would race and return 403.
 *
 * Returns the subscription id (the verify token is already stored on the row).
 */
export async function ensureSubscription(callbackUrl: string): Promise<{
  subscriptionId: number
  reused: boolean
}> {
  const { clientId, clientSecret } = assertCreds()

  // 1. If a subscription already exists with the same callback URL, reuse it.
  //    Persist whatever verify token is already on the connection row (or mint
  //    one if missing — this case is mostly cosmetic since reusing means we
  //    won't see another handshake).
  const existing = await listSubscriptions()
  const matching = existing.find(s => s.callback_url === callbackUrl)
  if (matching) {
    const conn = await prisma.stravaConnection.findUnique({ where: { userId: 'default' } })
    if (!conn?.webhookVerifyToken) {
      await prisma.stravaConnection.updateMany({
        where: { userId: 'default' },
        data: { webhookVerifyToken: randomBytes(16).toString('hex') },
      })
    }
    return { subscriptionId: matching.id, reused: true }
  }

  // 2. If a stale subscription exists on a different callback URL, delete it
  //    (Strava rejects creation while one exists).
  for (const s of existing) {
    await deleteSubscription(s.id).catch(() => {})
  }

  // 3. Mint and PERSIST a verify token before calling Strava, so the handshake
  //    GET succeeds when Strava calls our webhook URL during subscribe.
  const verifyToken = randomBytes(16).toString('hex')
  await prisma.stravaConnection.updateMany({
    where: { userId: 'default' },
    data: { webhookVerifyToken: verifyToken },
  })

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: callbackUrl,
    verify_token: verifyToken,
  })
  const res = await fetch(STRAVA_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Strava subscribe failed: ${res.status} ${text}`)
  }
  const data = (await res.json()) as { id: number }
  return { subscriptionId: data.id, reused: false }
}

export async function deleteSubscription(subscriptionId: number): Promise<void> {
  const { clientId, clientSecret } = assertCreds()
  const url = `${STRAVA_PUSH_URL}/${subscriptionId}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(`Strava unsubscribe failed: ${res.status} ${text}`)
  }
}
