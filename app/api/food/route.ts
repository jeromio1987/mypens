import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  inferFoodTags,
  parseMicrosJson,
  serializeMicros,
  serializeTags,
  type FoodMicros,
} from '@/lib/foodMicros'
import { foodNameKey } from '@/lib/foodNameKey'

function coerceMicros(raw: unknown): FoodMicros | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const m = parseMicrosJson(raw)
    return Object.keys(m).length ? m : null
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const out: FoodMicros = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n) && n >= 0) out[k] = Math.round(n * 100) / 100
    }
    return Object.keys(out).length ? out : null
  }
  return null
}

function coerceTags(raw: unknown): string[] | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      if (Array.isArray(p)) return p.filter((t): t is string => typeof t === 'string').slice(0, 12)
    } catch {
      return null
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 12)
  }
  return null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      date,
      meal = 'snack',
      name,
      kcal = 0,
      proteinG = 0,
      carbsG = 0,
      fatG = 0,
      fiberG = 0,
      notes,
    } = body

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const micros = coerceMicros(body.micros ?? body.microsJson)
    const providedTags = coerceTags(body.tags ?? body.tagsJson)
    const tags =
      providedTags ??
      inferFoodTags({
        kcal: Number(kcal) || 0,
        proteinG: Number(proteinG) || 0,
        fiberG: Number(fiberG) || 0,
        name: String(name),
      })

    const base = {
      date,
      meal,
      name,
      kcal,
      proteinG,
      carbsG,
      fatG,
      fiberG,
      notes,
    }
    let entry
    try {
      entry = await prisma.foodEntry.create({
        data: {
          ...base,
          microsJson: serializeMicros(micros),
          tagsJson: serializeTags(tags),
        },
      })
    } catch (first) {
      // Pre-migration DB: micros/tags/enrichment columns missing — still save macros.
      // Note: Prisma RETURNING includes all schema fields; a missing enrichmentJson
      // column makes even create({ data: base }) fail until migrate deploy.
      const msg = first instanceof Error ? first.message : String(first)
      if (!/microsJson|tagsJson|enrichmentJson|does not exist|Unknown argument/i.test(msg)) {
        throw first
      }
      console.warn('[food POST] optional food columns missing; retrying macros-only', msg.slice(0, 160))
      entry = await prisma.foodEntry.create({ data: base })
    }
    return NextResponse.json(entry)
  } catch (error) {
    console.error(error)
    const detail = error instanceof Error ? error.message : 'Failed to save'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'production' ? 'Failed to save' : detail },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const search = searchParams.get('search')

    if (search && search.length >= 2) {
      const entries = await prisma.foodEntry.findMany({
        where: { name: { contains: search, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      const seen = new Set<string>()
      const unique = entries.filter(e => {
        const key = foodNameKey(e.name) || e.name.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).slice(0, 8)
      return NextResponse.json(unique)
    }

    const entries = await prisma.foodEntry.findMany({
      where: date ? { date } : undefined,
      orderBy: [{ date: 'desc' }, { createdAt: 'asc' }],
      take: date ? undefined : 100,
    })
    return NextResponse.json(entries)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, meal, name, kcal, proteinG, carbsG, fatG, fiberG, notes, date } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    if (date !== undefined && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
      return NextResponse.json({ error: 'date must be yyyy-mm-dd' }, { status: 400 })
    }

    const micros = body.micros !== undefined || body.microsJson !== undefined
      ? coerceMicros(body.micros ?? body.microsJson)
      : undefined
    const tags = body.tags !== undefined || body.tagsJson !== undefined
      ? coerceTags(body.tags ?? body.tagsJson)
      : undefined

    const entry = await prisma.foodEntry.update({
      where: { id },
      data: {
        ...(date      !== undefined && { date }),
        ...(meal      !== undefined && { meal }),
        ...(name      !== undefined && { name }),
        ...(kcal      !== undefined && { kcal:     Number(kcal) }),
        ...(proteinG  !== undefined && { proteinG: Number(proteinG) }),
        ...(carbsG    !== undefined && { carbsG:   Number(carbsG) }),
        ...(fatG      !== undefined && { fatG:     Number(fatG) }),
        ...(fiberG    !== undefined && { fiberG:   Number(fiberG) }),
        ...(notes     !== undefined && { notes }),
        ...(micros !== undefined && { microsJson: serializeMicros(micros) }),
        ...(tags !== undefined && { tagsJson: serializeTags(tags ?? []) }),
      },
    })
    return NextResponse.json(entry)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await prisma.foodEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
