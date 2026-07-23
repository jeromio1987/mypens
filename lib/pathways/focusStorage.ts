import {
  FOCUS_STORAGE_KEY,
  type PathwayId,
} from '@/lib/pathways/catalog'

export type FocusState = {
  breakId: PathwayId
  buildId: PathwayId
  weekStart: string
}

export function mondayISO(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const dd = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function loadFocus(): FocusState {
  try {
    const raw = localStorage.getItem(FOCUS_STORAGE_KEY)
    if (raw) {
      const o = JSON.parse(raw) as FocusState
      if (o?.breakId && o?.buildId) {
        return { ...o, weekStart: o.weekStart || mondayISO() }
      }
    }
  } catch {
    /* ignore */
  }
  return { breakId: 'cue', buildId: 'start', weekStart: mondayISO() }
}

export function saveFocus(f: FocusState) {
  localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(f))
}
