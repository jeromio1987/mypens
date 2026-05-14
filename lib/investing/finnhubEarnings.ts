/**
 * Optional Finnhub earnings calendar (Tier 1-C).
 * Free tier: https://finnhub.io/register — set FINNHUB_API_KEY in .env
 */

export type FinnhubEarningRow = {
  date: string
  symbol: string
  hour?: string
  epsEstimate?: number
  quarter?: number
  year?: number
}

export async function fetchFinnhubEarningsCalendar(
  symbols: string[],
  from: string,
  to: string,
  token: string | undefined,
): Promise<FinnhubEarningRow[]> {
  if (!token || symbols.length === 0) return []

  const out: FinnhubEarningRow[] = []
  const symSet = new Set(symbols.map(s => s.trim().toUpperCase()).filter(Boolean))

  for (const sym of symSet) {
    const url = new URL('https://finnhub.io/api/v1/calendar/earnings')
    url.searchParams.set('symbol', sym)
    url.searchParams.set('from', from)
    url.searchParams.set('to', to)
    url.searchParams.set('token', token)

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
    if (!res.ok) continue
    const json = (await res.json()) as { earningsCalendar?: Array<Record<string, unknown>> }
    const rows = json.earningsCalendar ?? []
    for (const r of rows) {
      const date = String(r.date ?? '')
      if (!date) continue
      out.push({
        date,
        symbol: String(r.symbol ?? sym).toUpperCase(),
        hour: r.hour != null ? String(r.hour) : undefined,
        epsEstimate: typeof r.epsEstimate === 'number' ? r.epsEstimate : undefined,
        quarter: typeof r.quarter === 'number' ? r.quarter : undefined,
        year: typeof r.year === 'number' ? r.year : undefined,
      })
    }
  }

  out.sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol))
  return out
}
