import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getValidAccessToken } from '@/lib/integrations/garmin/oauth'
import {
  fetchPingActivities,
  fetchPingPayload,
  importPushedActivities,
} from '@/lib/integrations/garmin/sync'
import { processPushedBodyComps, type GarminBodyComp } from '@/lib/integrations/garmin/bodyCompSync'
import { processPushedSleep } from '@/lib/integrations/garmin/sleepSync'
import type { GarminActivity } from '@/lib/integrations/garmin/api'

/**
 * Garmin's Push / Ping Service POSTs wellness notifications here.
 *
 * Supported envelopes (full summary OR ping pointer with callbackURL):
 *   { "activities": [...] }
 *   { "dailies": [...] }      — sleep hours from daily summaries
 *   { "sleeps": [...] }       — dedicated sleep summaries
 *   { "bodyComps": [...] }    — weight / body composition
 *   { "deregistrations": [...] }
 *
 * Auth: Garmin does not sign payloads. We require a shared secret supplied as
 * the `verify_token` query parameter on every inbound request. Set
 * `GARMIN_WEBHOOK_VERIFY_TOKEN` in the environment and register the webhook
 * URL with `?verify_token=<secret>` appended in the Garmin developer portal.
 */

interface PingRef {
  userId?: string
  userAccessToken?: string
  summaryId?: string
  callbackURL?: string
}

type IncomingActivity = (GarminActivity & PingRef) | PingRef
type IncomingDaily = PingRef & {
  calendarDate?: string
  sleepingSeconds?: number
  avgSleepingHRV?: number
  durationInSeconds?: number
  averageHrv?: number
}
type IncomingBodyComp = (GarminBodyComp & PingRef) | PingRef

interface GarminWebhookBody {
  activities?: IncomingActivity[]
  dailies?: IncomingDaily[]
  sleeps?: IncomingDaily[]
  bodyComps?: IncomingBodyComp[]
  deregistrations?: Array<{ userId?: string; userAccessToken?: string }>
}

function hasFullSummary(a: IncomingActivity): a is GarminActivity & PingRef {
  return typeof (a as GarminActivity).activityId !== 'undefined'
    && typeof (a as GarminActivity).startTimeInSeconds === 'number'
    && typeof (a as GarminActivity).activityType === 'string'
}

function hasSleepSummary(d: IncomingDaily): boolean {
  return Boolean(d.calendarDate && (d.sleepingSeconds || d.durationInSeconds))
}

function hasBodyCompSummary(b: IncomingBodyComp): b is GarminBodyComp & PingRef {
  return typeof (b as GarminBodyComp).calendarDate === 'string'
    && typeof (b as GarminBodyComp).weightInGrams === 'number'
}

function oursOnly<T extends PingRef>(items: T[], garminUserId: string): T[] {
  return items.filter(a => a.userId === garminUserId)
}

export async function POST(request: Request) {
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
    return NextResponse.json({ ok: true, ignored: 'not connected' })
  }

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

  if (!conn.garminUserId) {
    return NextResponse.json({ ok: true, ignored: 'no garmin userId on connection' })
  }

  const activities = oursOnly(Array.isArray(body.activities) ? body.activities : [], conn.garminUserId)
  const dailies = oursOnly(Array.isArray(body.dailies) ? body.dailies : [], conn.garminUserId)
  const sleeps = oursOnly(Array.isArray(body.sleeps) ? body.sleeps : [], conn.garminUserId)
  const bodyComps = oursOnly(Array.isArray(body.bodyComps) ? body.bodyComps : [], conn.garminUserId)

  if (activities.length + dailies.length + sleeps.length + bodyComps.length === 0) {
    return NextResponse.json({ ok: true, ignored: 'no matching summaries' })
  }

  void (async () => {
    try {
      // ── Activities ────────────────────────────────────────────────────
      const fullActivities: GarminActivity[] = []
      const activityPings: PingRef[] = []
      for (const a of activities) {
        if (hasFullSummary(a)) fullActivities.push(a)
        else if (a.callbackURL) activityPings.push(a)
      }
      if (fullActivities.length > 0) await importPushedActivities(fullActivities)
      if (activityPings.length > 0) {
        const { accessToken } = await getValidAccessToken()
        for (const ref of activityPings) {
          if (!ref.callbackURL) continue
          try {
            const fetched = await fetchPingActivities(ref.callbackURL, accessToken)
            if (fetched.length > 0) await importPushedActivities(fetched)
          } catch (err) {
            console.error('[garmin webhook] activity ping fetch failed', ref, err)
          }
        }
      }

      // ── Sleep (dailies + sleeps) ──────────────────────────────────────
      const sleepSummaries = [...dailies, ...sleeps].filter(hasSleepSummary)
      const sleepPings = [...dailies, ...sleeps].filter(d => !hasSleepSummary(d) && d.callbackURL)
      if (sleepSummaries.length > 0) await processPushedSleep(sleepSummaries)
      if (sleepPings.length > 0) {
        const { accessToken } = await getValidAccessToken()
        for (const ref of sleepPings) {
          if (!ref.callbackURL) continue
          try {
            const fetched = await fetchPingPayload<IncomingDaily>(ref.callbackURL, accessToken)
            if (fetched.length > 0) await processPushedSleep(fetched)
          } catch (err) {
            console.error('[garmin webhook] sleep ping fetch failed', ref, err)
          }
        }
      }

      // ── Body composition / weight ─────────────────────────────────────
      const fullBody: GarminBodyComp[] = []
      const bodyPings: PingRef[] = []
      for (const b of bodyComps) {
        if (hasBodyCompSummary(b)) fullBody.push(b)
        else if (b.callbackURL) bodyPings.push(b)
      }
      if (fullBody.length > 0) await processPushedBodyComps(fullBody)
      if (bodyPings.length > 0) {
        const { accessToken } = await getValidAccessToken()
        for (const ref of bodyPings) {
          if (!ref.callbackURL) continue
          try {
            const fetched = await fetchPingPayload<GarminBodyComp>(ref.callbackURL, accessToken, 'bodyComps')
            if (fetched.length > 0) await processPushedBodyComps(fetched)
          } catch (err) {
            console.error('[garmin webhook] bodyComp ping fetch failed', ref, err)
          }
        }
      }

      await prisma.garminConnection.updateMany({
        where: { userId: 'default' },
        data: { lastSyncAt: new Date(), lastError: null, lastErrorAt: null },
      })
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
