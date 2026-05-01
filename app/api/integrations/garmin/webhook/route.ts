import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getValidAccessToken } from '@/lib/integrations/garmin/oauth'
import { fetchPingActivities, importPushedActivities } from '@/lib/integrations/garmin/sync'
import type { GarminActivity } from '@/lib/integrations/garmin/api'

/**
 * Garmin's Activity (Push / Ping) Service POSTs activity notifications here.
 *
 * Push payloads carry the full activity summary:
 *   { "activities": [ { activityId, activityType, startTimeInSeconds, ... } ] }
 *
 * Ping payloads only carry pointers; the full data must be fetched from the
 * provided callbackURL with the user's bearer token:
 *   { "activities": [ { userId, userAccessToken, summaryId, callbackURL } ] }
 *
 * We support both shapes. Garmin retries on non-2xx responses, so we ack
 * immediately and process asynchronously — slow imports must not time out
 * the webhook.
 *
 * Auth: Garmin does not sign payloads. We require a shared secret supplied as
 * the `verify_token` query parameter on every inbound request. Set
 * `GARMIN_WEBHOOK_VERIFY_TOKEN` in the environment and register the webhook
 * URL with `?verify_token=<secret>` appended in the Garmin developer portal.
 * Requests without a valid token are rejected (403) before any DB access.
 *
 * Within verified payloads, activity items are further validated against the
 * `garminUserId` stored on the connection row. Items for a different user are
 * silently discarded, and items missing `userId` are treated as foreign.
 */

interface PingActivityRef {
  userId?: string
  userAccessToken?: string
  summaryId?: string
  callbackURL?: string
}

type IncomingActivity = (GarminActivity & PingActivityRef) | PingActivityRef

interface GarminWebhookBody {
  activities?: IncomingActivity[]
  // Garmin also sends `deregistrations: [{ userId, userAccessToken }]` when a
  // user revokes app access from their Garmin account.
  deregistrations?: Array<{ userId?: string; userAccessToken?: string }>
}

function hasFullSummary(a: IncomingActivity): a is GarminActivity & PingActivityRef {
  return typeof (a as GarminActivity).activityId !== 'undefined'
    && typeof (a as GarminActivity).startTimeInSeconds === 'number'
    && typeof (a as GarminActivity).activityType === 'string'
}

export async function POST(request: Request) {
  // Verify the shared webhook secret. Set GARMIN_WEBHOOK_VERIFY_TOKEN in the
  // environment and append ?verify_token=<secret> to the webhook URL
  // registered in the Garmin developer portal. This is required — requests
  // without a valid token are rejected regardless of their payload content.
  const verifyToken = process.env.GARMIN_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) {
    console.error('[garmin webhook] GARMIN_WEBHOOK_VERIFY_TOKEN is not configured; rejecting request')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  const url = new URL(request.url)
  const incoming = url.searchParams.get('verify_token')
  if (!incoming || incoming !== verifyToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: GarminWebhookBody
  try {
    body = (await request.json()) as GarminWebhookBody
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const conn = await prisma.garminConnection.findUnique({ where: { userId: 'default' } })
  if (!conn) {
    // Nothing to do — no connected user. Ack so Garmin doesn't retry.
    return NextResponse.json({ ok: true, ignored: 'not connected' })
  }

  // Handle deregistration: user revoked the app from Garmin's side.
  if (Array.isArray(body.deregistrations)) {
    const ours = body.deregistrations.find(d => d.userId && d.userId === conn.garminUserId)
    if (ours) {
      void (async () => {
        try {
          await prisma.garminConnection.deleteMany({ where: { userId: 'default' } })
        } catch (err) {
          console.error('[garmin webhook] deregistration cleanup failed', err)
        }
      })()
      return NextResponse.json({ ok: true, deregistered: true })
    }
  }

  const activities = Array.isArray(body.activities) ? body.activities : []
  if (activities.length === 0) {
    return NextResponse.json({ ok: true, ignored: 'no activities' })
  }

  // Drop anything for a different Garmin user. Without a stored garminUserId
  // we cannot authenticate any item, so we ignore the entire payload. With
  // one, we require an exact match — items missing `userId` are treated as
  // foreign to prevent unauthenticated injection.
  if (!conn.garminUserId) {
    return NextResponse.json({ ok: true, ignored: 'no garmin userId on connection' })
  }
  const ours = activities.filter(a => a.userId === conn.garminUserId)

  if (ours.length === 0) {
    return NextResponse.json({ ok: true, ignored: 'foreign user' })
  }

  // Fire-and-forget the actual import — Garmin expects a quick 200 ack.
  void (async () => {
    try {
      const fullSummaries: GarminActivity[] = []
      const pingRefs: PingActivityRef[] = []
      for (const a of ours) {
        if (hasFullSummary(a)) fullSummaries.push(a)
        else if (a.callbackURL) pingRefs.push(a)
      }

      if (fullSummaries.length > 0) {
        await importPushedActivities(fullSummaries)
      }

      if (pingRefs.length > 0) {
        const { accessToken } = await getValidAccessToken()
        for (const ref of pingRefs) {
          if (!ref.callbackURL) continue
          try {
            const fetched = await fetchPingActivities(ref.callbackURL, accessToken)
            if (fetched.length > 0) await importPushedActivities(fetched)
          } catch (err) {
            console.error('[garmin webhook] ping fetch failed', ref, err)
            const message = err instanceof Error ? err.message : String(err)
            await prisma.garminConnection.updateMany({
              where: { userId: 'default' },
              data: { lastError: message.slice(0, 500), lastErrorAt: new Date() },
            }).catch(e => console.error('[garmin webhook] failed to persist error', e))
          }
        }
      }
    } catch (err) {
      console.error('[garmin webhook] processing failed', err)
      const message = err instanceof Error ? err.message : String(err)
      await prisma.garminConnection.updateMany({
        where: { userId: 'default' },
        data: { lastError: message.slice(0, 500), lastErrorAt: new Date() },
      }).catch(e => console.error('[garmin webhook] failed to persist error', e))
    }
  })()

  return NextResponse.json({ ok: true })
}
