'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarDays,
  ListPlus,
  Radio,
  Newspaper,
  FlaskConical,
  RefreshCw,
  Trash2,
  StickyNote,
} from 'lucide-react'
import { fromDateStr, shiftDateStr, today } from '@/lib/timeWindow'

type Tab = 'calendar' | 'watchlist' | 'regime' | 'sentiment' | 'backtest' | 'scenarios'

const SCENARIOS_KEY = 'mypens_investing_scenarios_v1'

type CalEvent = { id?: string; date: string; title: string; kind: string; symbol?: string | null; source: string }

const DEFAULT_TICKERS = ['NXE', 'UUUU', 'CCJ', 'POWL', 'VRT', 'GEV', 'NOG']

export default function InvestingHubPage() {
  const [tab, setTab] = useState<Tab>('calendar')
  const todayStr = useMemo(() => today(), [])
  const range = useMemo(() => ({ from: todayStr, to: shiftDateStr(todayStr, 90) }), [todayStr])

  const [calEvents, setCalEvents] = useState<CalEvent[]>([])
  const [finnhub, setFinnhub] = useState(false)
  const [symbols, setSymbols] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [manualDate, setManualDate] = useState(todayStr)
  const [manualTitle, setManualTitle] = useState('')
  const [manualSym, setManualSym] = useState('')

  const [regimeHistory, setRegimeHistory] = useState<
    { id: string; effectiveDate: string; regime: string; notes: string | null }[]
  >([])
  const [regimePick, setRegimePick] = useState('risk_on')
  const [regimeNotes, setRegimeNotes] = useState('')
  const [effDate, setEffDate] = useState(todayStr)

  const [sentimentRows, setSentimentRows] = useState<
    { symbol: string; score: number; headlineCount: number; sample: string[] }[]
  >([])
  const [sentLoading, setSentLoading] = useState(false)

  const [bt, setBt] = useState<{ sleepGte: number; regime: string }>({ sleepGte: 4, regime: 'risk_on' })
  const [btResult, setBtResult] = useState<string | null>(null)

  const eventWeekBuckets = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of calEvents) {
      const k = shiftDateStr(e.date, -fromDateStr(e.date).getDay())
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
  }, [calEvents])

  type Scenario = { id: string; title: string; body: string; createdAt: string }
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [scTitle, setScTitle] = useState('')
  const [scBody, setScBody] = useState('')

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(SCENARIOS_KEY) : null
      if (raw) setScenarios(JSON.parse(raw) as Scenario[])
    } catch {
      setScenarios([])
    }
  }, [])

  const persistScenarios = (next: Scenario[]) => {
    setScenarios(next)
    try {
      localStorage.setItem(SCENARIOS_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const loadCalendar = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const q = new URLSearchParams({ from: range.from, to: range.to })
      const r = await fetch(`/api/investing/calendar?${q}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'calendar failed')
      setCalEvents(j.events || [])
      setFinnhub(Boolean(j.finnhub))
      setSymbols(j.watchlist || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [range.from, range.to])

  const loadRegime = useCallback(async () => {
    const r = await fetch('/api/investing/regime')
    const j = await r.json()
    setRegimeHistory(j.history || [])
  }, [])

  useEffect(() => {
    loadCalendar()
    loadRegime()
  }, [loadCalendar, loadRegime])

  const saveWatchlist = async (next: string[]) => {
    const r = await fetch('/api/investing/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: next }),
    })
    const j = await r.json()
    if (r.ok) setSymbols(j.symbols || [])
  }

  const addManual = async () => {
    if (!manualTitle.trim()) return
    const r = await fetch('/api/investing/manual-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: manualDate,
        title: manualTitle.trim(),
        symbol: manualSym.trim() || null,
      }),
    })
    if (r.ok) {
      setManualTitle('')
      loadCalendar()
    }
  }

  const delManual = async (id: string) => {
    await fetch(`/api/investing/manual-events?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    loadCalendar()
  }

  const saveRegime = async () => {
    const r = await fetch('/api/investing/regime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regime: regimePick,
        notes: regimeNotes || null,
        effectiveDate: effDate,
      }),
    })
    if (r.ok) {
      setRegimeNotes('')
      loadRegime()
    }
  }

  const runSentiment = async () => {
    setSentLoading(true)
    try {
      const r = await fetch('/api/investing/sentiment?fromWatchlist=1')
      const j = await r.json()
      setSentimentRows(j.results || [])
    } finally {
      setSentLoading(false)
    }
  }

  const runBacktest = async () => {
    const q = new URLSearchParams({
      sleepGte: String(bt.sleepGte),
      regime: bt.regime,
    })
    const r = await fetch(`/api/investing/backtest?${q}`)
    const j = await r.json()
    setBtResult(JSON.stringify(j, null, 2))
  }

  const tabs: { id: Tab; label: string; icon: typeof CalendarDays }[] = [
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'watchlist', label: 'Watchlist', icon: ListPlus },
    { id: 'regime', label: 'Regime', icon: Radio },
    { id: 'sentiment', label: 'Sentiment', icon: Newspaper },
    { id: 'backtest', label: 'Backtest', icon: FlaskConical },
    { id: 'scenarios', label: 'Scenarios', icon: StickyNote },
  ]

  return (
    <main className="min-h-screen bg-pens-deep text-pens-cream px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/morning-brief" className="text-pens-cream/40 hover:text-pens-cream/70">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-pens-gold font-semibold">Tier 1-C · 2-E,F,H</p>
              <h1 className="text-2xl font-bold">Investing hub</h1>
              <p className="text-xs text-pens-cream/40 mt-1">
                Calendar + watchlist + regime alerts (in-app + optional ntfy) + headline sentiment + simple sleep/regime backtest.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { loadCalendar(); loadRegime() }}
            className="flex items-center gap-1 text-xs text-pens-cream/50 hover:text-pens-cream/80"
          >
            <RefreshCw size={14} /> Sync
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                tab === t.id
                  ? 'border-pens-gold bg-pens-gold/10 text-pens-gold'
                  : 'border-pens-muted/30 bg-pens-navy/40 text-pens-cream/50'
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {err && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>
        )}

        {tab === 'calendar' && (
          <section className="space-y-4">
            <p className="text-xs text-pens-cream/50">
              Merges static FOMC/CPI (verify yearly), your manual rows, and Finnhub earnings when{' '}
              <code className="text-pens-gold/80">FINNHUB_API_KEY</code> is set. Finnhub:{' '}
              <span className={finnhub ? 'text-emerald-400' : 'text-amber-400'}>{finnhub ? 'on' : 'off'}</span>.
            </p>
            {loading ? (
              <p className="text-sm text-pens-cream/40">Loading…</p>
            ) : (
              <ul className="space-y-2">
                {calEvents.map((e, i) => (
                  <li
                    key={`${e.date}-${e.title}-${e.source}-${i}`}
                    className="flex justify-between gap-3 rounded-xl border border-pens-muted/20 bg-pens-navy/40 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-bold text-pens-cream">{e.date}</p>
                      <p className="text-pens-cream/70">{e.title}</p>
                      <p className="text-[10px] uppercase tracking-wider text-pens-cream/30 mt-1">
                        {e.kind} · {e.source}
                        {e.symbol ? ` · ${e.symbol}` : ''}
                      </p>
                    </div>
                    {e.source === 'manual' && e.id && (
                      <button
                        type="button"
                        onClick={() => delManual(e.id!)}
                        className="self-start text-pens-cream/30 hover:text-red-300 p-1"
                        title="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!loading && calEvents.length > 0 && (
              <div className="rounded-xl border border-pens-muted/20 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-semibold mb-2">
                  Calendar density (weeks, Sun-start)
                </p>
                <div className="flex items-end gap-1 h-24">
                  {eventWeekBuckets.map(([wk, n]) => {
                    const max = Math.max(...eventWeekBuckets.map(([, c]) => c), 1)
                    const h = Math.max(6, Math.round((n / max) * 80))
                    return (
                      <div key={wk} className="flex-1 flex flex-col items-center gap-1 justify-end">
                        <div
                          className="w-full rounded-t bg-amber-500/70"
                          style={{ height: h }}
                          title={`Week of ${wk}: ${n} events`}
                        />
                        <span className="text-[8px] text-pens-cream/35 truncate w-full text-center">{wk.slice(5)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-pens-muted/30 bg-pens-navy/30 p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-pens-cream/40 font-semibold">Add manual event</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={manualDate}
                  onChange={ev => setManualDate(ev.target.value)}
                  className="rounded-lg bg-pens-deep border border-pens-muted/30 px-2 py-2 text-sm"
                />
                <input
                  placeholder="Ticker (opt)"
                  value={manualSym}
                  onChange={ev => setManualSym(ev.target.value.toUpperCase())}
                  className="rounded-lg bg-pens-deep border border-pens-muted/30 px-2 py-2 text-sm"
                />
              </div>
              <input
                placeholder="Title — e.g. NXE earnings BMO"
                value={manualTitle}
                onChange={ev => setManualTitle(ev.target.value)}
                className="w-full rounded-lg bg-pens-deep border border-pens-muted/30 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addManual}
                className="rounded-lg bg-pens-gold/20 border border-pens-gold/40 px-4 py-2 text-xs font-bold text-pens-gold"
              >
                Save event
              </button>
            </div>
          </section>
        )}

        {tab === 'watchlist' && (
          <section className="space-y-4">
            <p className="text-xs text-pens-cream/50">Used for Finnhub earnings + sentiment. One POST replaces the full list.</p>
            <div className="flex flex-wrap gap-2">
              {symbols.map(s => (
                <span
                  key={s}
                  className="px-3 py-1 rounded-full border border-pens-muted/30 text-xs font-mono font-bold bg-pens-navy/50"
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_TICKERS.filter(t => !symbols.includes(t)).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => saveWatchlist([...symbols, t])}
                  className="text-xs px-2 py-1 rounded border border-dashed border-pens-muted/40 text-pens-cream/50 hover:border-pens-gold/50 hover:text-pens-gold"
                >
                  + {t}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => saveWatchlist([])}
              className="text-xs text-red-300/80 hover:text-red-200 flex items-center gap-1"
            >
              <Trash2 size={12} /> Clear all
            </button>
          </section>
        )}

        {tab === 'regime' && (
          <section className="space-y-4">
            <p className="text-xs text-pens-cream/50">
              Tier 2-E: changing regime vs previous stretch fires an in-app notification + optional{' '}
              <code className="text-pens-gold/80">NTFY_INVESTING_URL</code> push.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] uppercase text-pens-cream/40">Effective date</label>
              <label className="text-[10px] uppercase text-pens-cream/40">Regime</label>
              <input
                type="date"
                value={effDate}
                onChange={e => setEffDate(e.target.value)}
                className="rounded-lg bg-pens-deep border border-pens-muted/30 px-2 py-2 text-sm"
              />
              <select
                value={regimePick}
                onChange={e => setRegimePick(e.target.value)}
                className="rounded-lg bg-pens-deep border border-pens-muted/30 px-2 py-2 text-sm"
              >
                {['risk_on', 'risk_off', 'neutral', 'mixed'].map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Notes (optional)"
              value={regimeNotes}
              onChange={e => setRegimeNotes(e.target.value)}
              className="w-full rounded-lg bg-pens-deep border border-pens-muted/30 px-3 py-2 text-sm min-h-[72px]"
            />
            <button
              type="button"
              onClick={saveRegime}
              className="rounded-lg bg-pens-crimson/30 border border-pens-crimson/50 px-4 py-2 text-xs font-bold text-pens-cream"
            >
              Log regime
            </button>
            <ul className="space-y-2 pt-4 border-t border-pens-muted/20">
              {regimeHistory.map(h => (
                <li key={h.id} className="text-sm flex justify-between gap-2">
                  <span className="text-pens-cream/60">{h.effectiveDate}</span>
                  <span className="font-mono font-bold text-pens-gold">{h.regime}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'sentiment' && (
          <section className="space-y-4">
            <p className="text-xs text-pens-cream/50">
              Tier 2-F: Google News RSS + naive keyword score. For orientation only — dismiss mentally when noisy.
            </p>
            <button
              type="button"
              disabled={sentLoading || symbols.length === 0}
              onClick={runSentiment}
              className="rounded-lg bg-pens-navy/60 border border-pens-muted/30 px-4 py-2 text-xs font-bold disabled:opacity-40"
            >
              {sentLoading ? 'Loading…' : 'Run on watchlist'}
            </button>
            {!symbols.length && (
              <p className="text-xs text-amber-400/90">Add tickers in Watchlist first.</p>
            )}
            <ul className="space-y-3">
              {sentimentRows.map(row => (
                <li key={row.symbol} className="rounded-xl border border-pens-muted/20 bg-pens-navy/40 p-4">
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono font-bold">{row.symbol}</span>
                    <span className="text-xs text-pens-cream/50">{row.headlineCount} headlines</span>
                  </div>
                  <p className="text-lg font-black mt-1">{row.score > 0 ? '+' : ''}{row.score.toFixed(2)}</p>
                  <ul className="mt-2 space-y-1 text-[11px] text-pens-cream/50">
                    {row.sample.map((s, i) => (
                      <li key={i}>· {s}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'scenarios' && (
          <section className="space-y-4">
            <p className="text-xs text-pens-cream/50">
              Saved only in this browser (localStorage). Use for trade theses, sizing rules, or “if CPI prints hot” playbooks.
            </p>
            <div className="rounded-xl border border-pens-muted/30 bg-pens-navy/30 p-4 space-y-2">
              <input
                placeholder="Title"
                value={scTitle}
                onChange={(e) => setScTitle(e.target.value)}
                className="w-full rounded-lg bg-pens-deep border border-pens-muted/30 px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Notes — regimes, hedges, levels…"
                value={scBody}
                onChange={(e) => setScBody(e.target.value)}
                className="w-full rounded-lg bg-pens-deep border border-pens-muted/30 px-3 py-2 text-sm min-h-[100px]"
              />
              <button
                type="button"
                onClick={() => {
                  const title = scTitle.trim()
                  if (!title) return
                  const row: Scenario = {
                    id: crypto.randomUUID(),
                    title,
                    body: scBody.trim(),
                    createdAt: new Date().toISOString(),
                  }
                  persistScenarios([row, ...scenarios])
                  setScTitle('')
                  setScBody('')
                }}
                className="rounded-lg bg-pens-gold/20 border border-pens-gold/40 px-4 py-2 text-xs font-bold text-pens-gold"
              >
                Save scenario
              </button>
            </div>
            <ul className="space-y-2">
              {scenarios.map((s) => (
                <li key={s.id} className="rounded-xl border border-pens-muted/20 bg-pens-navy/40 p-4">
                  <div className="flex justify-between gap-2 items-start">
                    <div>
                      <p className="font-bold text-pens-cream">{s.title}</p>
                      <p className="text-[10px] text-pens-cream/35 mt-1">{new Date(s.createdAt).toLocaleString()}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => persistScenarios(scenarios.filter((x) => x.id !== s.id))}
                      className="text-pens-cream/30 hover:text-red-300 p-1"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {s.body ? <p className="text-sm text-pens-cream/70 mt-2 whitespace-pre-wrap">{s.body}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'backtest' && (
          <section className="space-y-4">
            <p className="text-xs text-pens-cream/50">
              Tier 2-H: counts nights where sleep quality ≥ threshold AND forward-filled regime matches. Requires regime
              rows with effective dates covering those nights.
            </p>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-pens-cream/50">Sleep ≥</label>
              <select
                value={bt.sleepGte}
                onChange={e => setBt({ ...bt, sleepGte: Number(e.target.value) })}
                className="rounded bg-pens-deep border border-pens-muted/30 text-sm"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <label className="text-xs text-pens-cream/50 ml-2">Regime</label>
              <select
                value={bt.regime}
                onChange={e => setBt({ ...bt, regime: e.target.value })}
                className="rounded bg-pens-deep border border-pens-muted/30 text-sm"
              >
                {['risk_on', 'risk_off', 'neutral', 'mixed'].map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={runBacktest}
                className="ml-auto text-xs font-bold rounded-lg border border-pens-gold/40 px-3 py-2 text-pens-gold"
              >
                Run
              </button>
            </div>
            {btResult != null && (
              <pre className="text-[11px] overflow-auto rounded-xl border border-pens-muted/20 bg-black/40 p-4 text-emerald-200/90">
                {btResult}
              </pre>
            )}
          </section>
        )}

      </div>
    </main>
  )
}
