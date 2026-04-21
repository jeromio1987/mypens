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
 * Auth: Garmin does not sign payloads, but every notification includes the
 * `userId` for the originating Garmin user. We reject anything that doesn't
 * match the `garminUserId` stored on our connection row to prevent a random
 * caller from triggering imports.
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

  // Drop anything for a different Garmin user.
  const ours = conn.garminUserId
    ? activities.filter(a => !a.userId || a.userId === conn.garminUserId)
    : activities

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
          }
        }
      }
    } catch (err) {
      console.error('[garmin webhook] processing failed', err)
    }
  })()

  return NextResponse.json({ ok: true })
}
