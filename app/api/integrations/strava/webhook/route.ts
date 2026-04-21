import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { deleteImportedActivity, syncSingleActivity } from '@/lib/integrations/strava/sync'

/**
 * GET — Strava subscription verification handshake.
 * Strava calls this with hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 * If the verify_token matches the one we stored when subscribing, echo back the
 * challenge as { "hub.challenge": "<value>" }.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode !== 'subscribe' || !challenge || !token) {
    return NextResponse.json({ error: 'invalid handshake' }, { status: 400 })
  }

  const conn = await prisma.stravaConnection.findUnique({ where: { userId: 'default' } })
  if (!conn?.webhookVerifyToken || conn.webhookVerifyToken !== token) {
    return NextResponse.json({ error: 'invalid verify_token' }, { status: 403 })
  }

  return NextResponse.json({ 'hub.challenge': challenge })
}

interface StravaEvent {
  object_type: 'activity' | 'athlete'
  object_id: number
  aspect_type: 'create' | 'update' | 'delete'
  owner_id: number
  subscription_id: number
  event_time: number
  updates?: Record<string, string>
}

/**
 * POST — incoming Strava webhook event. We acknowledge immediately (Strava
 * requires a 200 within 2 seconds) and process asynchronously so a slow
 * import doesn't time out the webhook.
 */
export async function POST(request: Request) {
  let event: StravaEvent
  try {
    event = (await request.json()) as StravaEvent
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  // Authenticity check: this endpoint is publicly reachable and mutates data
  // (including delete). Strava does not sign webhook payloads, but every event
  // includes the subscription_id we registered. Reject anything that doesn't
  // match the subscription id stored on our connection row — this prevents an
  // anonymous caller from triggering imports or deleting imported entries by
  // guessing externalIds.
  const conn = await prisma.stravaConnection.findUnique({ where: { userId: 'default' } })
  if (!conn?.webhookId || conn.webhookId !== event.subscription_id) {
    return NextResponse.json({ error: 'unknown subscription' }, { status: 403 })
  }

  // Only act on activity events; ignore athlete deauthorization etc. for now.
  if (event.object_type !== 'activity') {
    return NextResponse.json({ ok: true, ignored: 'non-activity event' })
  }

  // Only act on events for the athlete we have tokens for.
  if (conn.athleteId && String(event.owner_id) !== conn.athleteId) {
    return NextResponse.json({ ok: true, ignored: 'foreign owner' })
  }

  // Fire-and-forget the actual import work. Awaiting could exceed Strava's
  // 2-second ack window. Errors are persisted to StravaConnection.lastError
  // by the sync helpers themselves.
  void (async () => {
    try {
      if (event.aspect_type === 'delete') {
        await deleteImportedActivity(event.object_id)
      } else {
        await syncSingleActivity(event.object_id)
      }
    } catch (err) {
      console.error('[strava webhook] processing failed', event, err)
    }
  })()

  return NextResponse.json({ ok: true })
}
