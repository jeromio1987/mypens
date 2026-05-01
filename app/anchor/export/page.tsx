import { prisma } from '@/lib/db'
import { computeStreaks, todayStr, shiftDate } from '@/lib/anchor/streaks'
import { computeMoneySaved } from '@/lib/anchor/money'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Read-only printable report. Print to PDF via the browser; no server-side PDF
// generation needed for v1. Open in a tab and Cmd/Ctrl-P → Save as PDF.
export default async function ExportPage() {
  const today = todayStr()
  const since = shiftDate(today, -30)

  const [entries, cravings, settingsRow] = await Promise.all([
    prisma.recoveryEntry.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'desc' },
    }),
    prisma.cravingEvent.findMany({
      where: { createdAt: { gte: new Date(`${since}T00:00:00`) } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.recoverySettings.findUnique({ where: { id: 'default' } }),
  ])

  const settings = settingsRow ?? {
    drinkCostEur: 7,
    cocaineGramEur: 70,
    escortNightEur: 1000,
    baselineDrinksPerWeek: 45,
    baselineCocaineGramsPerMonth: 3,
    baselineEscortsPerMonth: 1.5,
    resetStartDate: '2026-05-01',
    phase1ResetDays: 45,
  }

  const streaks = computeStreaks(entries, today)
  const money = computeMoneySaved(entries, settings, today)

  const cleanDays = entries.filter(
    e => !e.cocaineUsed && !e.escortUsed && e.alcoholDrinks === 0,
  ).length
  const drinksTotal = entries.reduce((s, e) => s + e.alcoholDrinks, 0)
  const cocaineDays = entries.filter(e => e.cocaineUsed).length
  const escortDays = entries.filter(e => e.escortUsed).length
  const moods = entries.filter(e => e.mood != null).map(e => e.mood as number)
  const energies = entries.filter(e => e.energy != null).map(e => e.energy as number)
  const sleeps = entries.filter(e => e.sleepHours != null).map(e => e.sleepHours as number)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

  return (
    <main className="min-h-screen bg-white text-black p-8 print:p-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-start mb-6 print:hidden">
        <Link href="/anchor" className="text-sm text-gray-500 hover:text-black">
          ← Back
        </Link>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') window.print()
          }}
          className="px-4 py-2 bg-black text-white text-sm rounded"
          // Required for client interactivity inside an RSC: wrap the button.
          // (Inline script avoided by using ssr-friendly form below.)
          formAction="javascript:window.print()"
        >
          Print / Save PDF
        </button>
      </div>

      <header className="border-b border-gray-300 pb-4 mb-6">
        <div className="text-xs uppercase tracking-widest text-gray-500">
          Recovery report — last 30 days
        </div>
        <h1 className="text-3xl font-bold mt-1">Jérôme · {since} → {today}</h1>
        <div className="text-sm text-gray-600 mt-1">
          Prepared for Dr. Vanderhenst · generated {new Date().toLocaleString()}
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-lg font-bold border-b border-gray-200 pb-1 mb-3">Streaks</h2>
        <div className="grid grid-cols-4 gap-3 text-sm">
          <Stat label="Alcohol-free" value={`${streaks.alcoholFreeDays}d`} />
          <Stat label="Cocaine-free" value={`${streaks.cocaineFreeDays}d`} />
          <Stat label="Escort-free" value={`${streaks.escortFreeDays}d`} />
          <Stat label="All-clean" value={`${streaks.compoundCleanDays}d`} />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-bold border-b border-gray-200 pb-1 mb-3">30-day totals</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Days logged" value={`${entries.length}`} />
          <Stat label="Fully clean days" value={`${cleanDays}`} />
          <Stat label="Total drinks" value={`${drinksTotal}`} />
          <Stat label="Cocaine days" value={`${cocaineDays}`} />
          <Stat label="Escort days" value={`${escortDays}`} />
          <Stat label="Cravings logged" value={`${cravings.length}`} />
          <Stat label="Avg mood (1–5)" value={moods.length ? avg(moods)!.toFixed(1) : '—'} />
          <Stat label="Avg energy (1–5)" value={energies.length ? avg(energies)!.toFixed(1) : '—'} />
          <Stat label="Avg sleep (h)" value={sleeps.length ? avg(sleeps)!.toFixed(1) : '—'} />
          <Stat label="Money saved" value={`€${money.totalEur.toFixed(0)}`} />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-bold border-b border-gray-200 pb-1 mb-3">Daily log</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-1.5 pr-2">Date</th>
              <th className="py-1.5 pr-2 text-right">Drinks</th>
              <th className="py-1.5 pr-2">Coc</th>
              <th className="py-1.5 pr-2">Esc</th>
              <th className="py-1.5 pr-2 text-right">Mood</th>
              <th className="py-1.5 pr-2 text-right">Energy</th>
              <th className="py-1.5 pr-2 text-right">Sleep</th>
              <th className="py-1.5">Notes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b border-gray-100 align-top">
                <td className="py-1.5 pr-2 font-mono">{e.date}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{e.alcoholDrinks}</td>
                <td className="py-1.5 pr-2">{e.cocaineUsed ? '●' : ''}</td>
                <td className="py-1.5 pr-2">{e.escortUsed ? '●' : ''}</td>
                <td className="py-1.5 pr-2 text-right">{e.mood ?? '—'}</td>
                <td className="py-1.5 pr-2 text-right">{e.energy ?? '—'}</td>
                <td className="py-1.5 pr-2 text-right">{e.sleepHours ?? '—'}</td>
                <td className="py-1.5 text-gray-700">{e.notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {cravings.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold border-b border-gray-200 pb-1 mb-3">Craving events</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-1.5 pr-2">When</th>
                <th className="py-1.5 pr-2">Target</th>
                <th className="py-1.5 pr-2">Action</th>
                <th className="py-1.5 pr-2">Outcome</th>
                <th className="py-1.5">Trigger</th>
              </tr>
            </thead>
            <tbody>
              {cravings.map(c => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-1.5 pr-2 font-mono">
                    {c.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-1.5 pr-2">{c.target}</td>
                  <td className="py-1.5 pr-2">{c.action.replace('_', ' ')}</td>
                  <td className="py-1.5 pr-2">{c.outcome}</td>
                  <td className="py-1.5 text-gray-700">{c.trigger ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  )
}
