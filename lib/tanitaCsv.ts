/** Tanita Health Planet / HealthPlanet CSV helpers — shared by API + client preview. */

export type TanitaColumnRole =
  | 'date'
  | 'scaleKg'
  | 'bodyFatPct'
  | 'muscleMassKg'
  | 'boneMassKg'
  | 'bodyWaterPct'
  | 'visceralFat'
  | 'ignore'

export const TANITA_FIELD_LABELS: Record<Exclude<TanitaColumnRole, 'ignore'>, string> = {
  date: 'date (YYYY-MM-DD)',
  scaleKg: 'scaleKg',
  bodyFatPct: 'bodyFatPct',
  muscleMassKg: 'muscleMassKg',
  boneMassKg: 'boneMassKg',
  bodyWaterPct: 'bodyWaterPct',
  visceralFat: 'visceralFat',
}

export interface TanitaColumnMapping {
  header: string
  role: TanitaColumnRole
  targetField?: string
}

export interface TanitaParsedRow {
  date: string
  scaleKg: number
  bodyFatPct: number | null
  muscleMassKg: number | null
  boneMassKg: number | null
  bodyWaterPct: number | null
  visceralFat: number | null
  rowNumber: number
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const cleaned = text.replace(/^\ufeff/, '')
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('##'))
  if (lines.length < 2) return { headers: [], rows: [] }

  const splitLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current)
    return result
  }

  const headers = splitLine(lines[0]).map(h => h.trim())
  const rows = lines.slice(1).map(line => {
    const vals = splitLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = (vals[i] ?? '').trim()
    })
    return row
  })
  return { headers, rows }
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .replace(/^\ufeff/, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\(([^)]+)\)/g, (_, inner) => `(${inner.replace(/\s/g, '')})`)
}

function inferRole(normalized: string): TanitaColumnRole {
  if (normalized.includes('date')) return 'date'
  if (normalized.includes('visceral')) return 'visceralFat'
  if (normalized.includes('fat') && normalized.includes('%')) return 'bodyFatPct'
  if (normalized.includes('weight') && !normalized.includes('fat')) return 'scaleKg'
  if (normalized.includes('muscle')) return 'muscleMassKg'
  if (normalized.includes('bone')) return 'boneMassKg'
  if (normalized.includes('water')) return 'bodyWaterPct'
  return 'ignore'
}

export function buildTanitaColumnMap(headers: string[]): {
  colIndexByRole: Partial<Record<Exclude<TanitaColumnRole, 'ignore'>, number>>
  mappings: TanitaColumnMapping[]
} {
  const colIndexByRole: Partial<Record<Exclude<TanitaColumnRole, 'ignore'>, number>> = {}
  const mappings: TanitaColumnMapping[] = []

  headers.forEach((raw, idx) => {
    const role = inferRole(normalizeHeader(raw))
    const targetField = role === 'ignore' ? undefined : TANITA_FIELD_LABELS[role as Exclude<TanitaColumnRole, 'ignore'>]
    mappings.push({ header: raw, role, targetField })
    if (role !== 'ignore' && colIndexByRole[role as Exclude<TanitaColumnRole, 'ignore'>] === undefined) {
      colIndexByRole[role as Exclude<TanitaColumnRole, 'ignore'>] = idx
    }
  })

  return { colIndexByRole, mappings }
}

/** Parse flexible local dates to ISO YYYY-MM-DD. Ambiguous d/m vs m/d defaults to D/M/Y (EU). */
export function parseFlexibleDate(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
  if (m) {
    const a = parseInt(m[1], 10)
    const b = parseInt(m[2], 10)
    const y = m[3]
    let day: number
    let month: number
    if (a > 12) {
      day = a
      month = b
    } else if (b > 12) {
      month = a
      day = b
    } else {
      day = a
      month = b
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return null
}

export function parseLocalizedFloat(s: string): number | null {
  const t = s.trim().replace(/\s/g, '')
  if (!t) return null
  const n = parseFloat(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function parseLocalizedInt(s: string): number | null {
  const t = s.trim().replace(/\s/g, '')
  if (!t) return null
  const n = parseInt(t.replace(',', '.').split('.')[0], 10)
  return Number.isFinite(n) ? n : null
}

function cellByRole(
  row: Record<string, string>,
  headers: string[],
  colIndexByRole: Partial<Record<Exclude<TanitaColumnRole, 'ignore'>, number>>,
  role: Exclude<TanitaColumnRole, 'ignore'>,
): string {
  const idx = colIndexByRole[role]
  if (idx === undefined) return ''
  const key = headers[idx]
  return (row[key] ?? '').trim()
}

export function parseTanitaDataRows(
  headers: string[],
  rows: Record<string, string>[],
  colIndexByRole: Partial<Record<Exclude<TanitaColumnRole, 'ignore'>, number>>,
): { parsed: TanitaParsedRow[]; errors: string[] } {
  const errors: string[] = []
  const parsed: TanitaParsedRow[] = []

  if (colIndexByRole.date === undefined) {
    errors.push('No Date column detected (need a header containing "date").')
    return { parsed, errors }
  }
  if (colIndexByRole.scaleKg === undefined) {
    errors.push('No weight column detected (need a header containing "weight" but not "fat", e.g. Weight(kg)).')
    return { parsed, errors }
  }

  const headerLineNumber = 1
  rows.forEach((record, i) => {
    const rowNumber = headerLineNumber + 1 + i
    const dateRaw = cellByRole(record, headers, colIndexByRole, 'date')
    const date = parseFlexibleDate(dateRaw)
    if (!date) {
      errors.push(`Row ${rowNumber}: invalid or empty date (${dateRaw || '—'}).`)
      return
    }

    const wRaw = cellByRole(record, headers, colIndexByRole, 'scaleKg')
    const scaleKg = parseLocalizedFloat(wRaw)
    if (scaleKg == null || scaleKg <= 0 || scaleKg > 500) {
      errors.push(`Row ${rowNumber}: invalid weight (${wRaw || '—'}).`)
      return
    }

    const bf = cellByRole(record, headers, colIndexByRole, 'bodyFatPct')
    const mm = cellByRole(record, headers, colIndexByRole, 'muscleMassKg')
    const bm = cellByRole(record, headers, colIndexByRole, 'boneMassKg')
    const bw = cellByRole(record, headers, colIndexByRole, 'bodyWaterPct')
    const vf = cellByRole(record, headers, colIndexByRole, 'visceralFat')

    parsed.push({
      date,
      scaleKg,
      bodyFatPct: bf ? parseLocalizedFloat(bf) : null,
      muscleMassKg: mm ? parseLocalizedFloat(mm) : null,
      boneMassKg: bm ? parseLocalizedFloat(bm) : null,
      bodyWaterPct: bw ? parseLocalizedFloat(bw) : null,
      visceralFat: vf ? parseLocalizedInt(vf) : null,
      rowNumber,
    })
  })

  return { parsed, errors }
}

export function analyzeTanitaCsv(text: string): {
  headers: string[]
  rows: Record<string, string>[]
  colIndexByRole: Partial<Record<Exclude<TanitaColumnRole, 'ignore'>, number>>
  mappings: TanitaColumnMapping[]
  parsed: TanitaParsedRow[]
  errors: string[]
} {
  const { headers, rows } = parseCsv(text)
  const { colIndexByRole, mappings } = buildTanitaColumnMap(headers)
  const { parsed, errors } = parseTanitaDataRows(headers, rows, colIndexByRole)
  return { headers, rows, colIndexByRole, mappings, parsed, errors }
}
