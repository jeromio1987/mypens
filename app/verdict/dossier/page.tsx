import Link from 'next/link'
import { ArrowLeft, AlertCircle, Wine, Droplet, Moon } from 'lucide-react'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmt(n: number, digits = 1): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '—'
}

interface Dossier {
  date: string
  hasAlcohol: boolean
  alcoholUnits: number
  hoursSinceAlcohol: number
  ethanolOffsetKcal: number
  dehydrationLiters: number
  inflammationPct: number
  sleepHours: number | null
  sleepQuality: number | null
  hrv: number | null
  metabolicDeficitPct: number
  tags: string[]
}

async function loadDossier(): Promise<Dossier> {
  const date = todayDate()
  const [weight, sleep, day] = await Promise.all([
    prisma.weightEntry.findFirst({ where: { date }, orderBy: { createdAt: 'desc' } }),
    prisma.sleepEntry.findUnique({ where: { date } }),
    prisma.dayEntry.findUnique({ where: { date } }),
  ])

  const alcoholUnits      = weight?.alcoholUnits ?? 0
  const hoursSinceAlcohol = weight?.hoursSinceAlcohol ?? 48
  const hasAlcohol        = alcoholUnits > 0 || hoursSinceAlcohol < 24

  // Honest proxies — derived only from values we actually store.
  const ethanolOffsetKcal  = Math.round(alcoholUnits * 70)              // ~7 kcal/g, 10g per UK unit
  const dehydrationLiters  = Math.round(alcoholUnits * 0.25 * 10) / 10  // ~250ml diuresis per unit
  const inflammationPct    = Math.min(40, Math.round(alcoholUnits * 4)) // rough CRP proxy

  const sleepHours   = sleep?.hours ?? null
  const sleepQuality = sleep?.quality ?? null
  const hrv          = sleep?.hrv ?? null

  const sleepDeficit   = sleepHours ? Math.max(0, 8 - sleepHours) / 8 : 0    // 0..1
  const alcoholImpact  = Math.min(1, alcoholUnits / 8)                        // 0..1
  const metabolicDeficitPct = Math.round((sleepDeficit * 50 + alcoholImpact * 50) * 10) / 10

  let tags: string[] = []
  try { tags = JSON.parse(day?.tags ?? '[]') } catch {}

  return {
    date,
    hasAlcohol,
    alcoholUnits,
    hoursSinceAlcohol,
    ethanolOffsetKcal,
    dehydrationLiters,
    inflammationPct,
    sleepHours,
    sleepQuality,
    hrv,
    metabolicDeficitPct,
    tags,
  }
}

export default async function DossierPage() {
  const d = await loadDossier()

  const auditId = `${d.date.slice(5).replace('-', '')}-DA`
  const dehydrationBars = Math.min(5, Math.round(d.dehydrationLiters / 0.4))

  return (
    <main className="min-h-screen bg-pens-deep text-pens-cream">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-pens-deep/95 backdrop-blur border-b border-pens-muted/20">
        <div className="max-w-4xl mx-auto flex justify-between items-center px-6 py-4">
          <Link href="/verdict" className="inline-flex items-center gap-2 text-pens-cream/60 hover:text-pens-cream transition-colors">
            <ArrowLeft size={18} />
            <span className="text-xs uppercase tracking-widest font-semibold">Verdict</span>
          </Link>
          <span className="font-[family-name:var(--font-headline)] font-black italic text-xl uppercase tracking-tight text-pens-cream">
            The Continental
          </span>
          <span className="w-12" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 pt-12 pb-32">
        {/* Hero */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
          <div className="md:col-span-7">
            <h1 className="font-[family-name:var(--font-headline)] text-6xl font-extrabold text-pens-cream leading-tight mb-4">
              The Damage Audit.
            </h1>
            <p className="text-xl text-pens-cream/70 max-w-md italic border-l-4 border-pens-crimson pl-6 py-2 font-[family-name:var(--font-headline)]">
              &ldquo;A night of excess is a debt to your future self. Here is the invoice.&rdquo;
            </p>
          </div>
          <div className="md:col-span-5 flex flex-col justify-end items-end text-right">
            <div className="bg-pens-navy text-pens-cream p-8 rounded-xl shadow-[0_32px_64px_rgba(0,0,0,0.5)] rotate-2 hover:rotate-0 transition-transform duration-500 border border-pens-muted/30">
              <span className="text-xs uppercase tracking-[0.2em] opacity-60">Audit ID: {auditId}</span>
              <h2 className="font-[family-name:var(--font-headline)] text-5xl font-bold mt-2">
                {fmt(d.metabolicDeficitPct)}<span className="text-pens-crimson">%</span>
              </h2>
              <p className="text-sm uppercase font-bold tracking-widest mt-1">Metabolic Deficit</p>
            </div>
          </div>
        </div>

        {/* No-alcohol guard */}
        {!d.hasAlcohol && (
          <div className="mb-16 rounded-xl border border-pens-muted/20 bg-pens-surface/40 p-8 flex items-start gap-4">
            <AlertCircle size={20} className="text-pens-gold shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-pens-cream mb-1">No alcohol logged for today</h3>
              <p className="text-sm text-pens-cream/60 leading-relaxed">
                The Damage Audit is most informative on a hangover day. The numbers below default to baseline — go to{' '}
                <Link href="/weight" className="border-b border-pens-crimson hover:text-pens-crimson">Weight</Link>{' '}
                and log the night before for a real reading.
              </p>
            </div>
          </div>
        )}

        {/* Bento — the metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Ethanol Offset */}
          <div className="bg-pens-surface/60 p-8 rounded-xl flex flex-col justify-between min-h-[300px] relative overflow-hidden border border-pens-muted/20">
            <div className="absolute top-4 right-4 opacity-10">
              <Wine size={120} className="text-pens-cream" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-headline)] text-2xl font-bold mb-4 text-pens-cream">Ethanol Offset</h3>
              <p className="text-pens-cream/60 text-sm leading-relaxed mb-6">
                Your liver prioritises toxin clearance over lipid metabolism. Fat oxidation is effectively suspended.
              </p>
            </div>
            <div>
              <div className="text-4xl font-[family-name:var(--font-headline)] font-black text-pens-cream">
                {d.ethanolOffsetKcal > 0 ? `−${d.ethanolOffsetKcal}` : '—'} <span className="text-base font-normal text-pens-cream/50">kcal</span>
              </div>
              <div className="h-1 w-full bg-pens-muted/30 mt-4 overflow-hidden rounded-full">
                <div
                  className="h-full bg-pens-crimson transition-all"
                  style={{ width: `${Math.min(100, d.alcoholUnits * 12)}%` }}
                />
              </div>
              <p className="text-[10px] uppercase tracking-widest mt-2 text-pens-cream/40">
                {fmt(d.alcoholUnits)} units logged
              </p>
            </div>
          </div>

          {/* Inflammation Tax */}
          <div className="bg-pens-navy text-pens-cream p-8 rounded-xl flex flex-col justify-between min-h-[300px] relative overflow-hidden border border-pens-muted/30">
            <div className="absolute top-4 right-4 opacity-10">
              <AlertCircle size={120} className="text-pens-cream" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-headline)] text-2xl font-bold mb-4">Inflammation Tax</h3>
              <p className="opacity-70 text-sm leading-relaxed mb-6">
                Elevated inflammatory markers detected. Expect systemic sluggishness through the recovery window.
              </p>
            </div>
            <div>
              <div className="text-4xl font-[family-name:var(--font-headline)] font-black text-pens-crimson">
                {d.inflammationPct > 0 ? `+${d.inflammationPct}%` : '—'}
              </div>
              <p className="text-[10px] uppercase tracking-tighter mt-4 opacity-50">Reactive Protein Spike (proxy)</p>
            </div>
          </div>

          {/* Dehydration Penalty */}
          <div className="bg-pens-surface/60 p-8 rounded-xl flex flex-col justify-between min-h-[300px] border border-pens-muted/20 relative overflow-hidden">
            <div className="absolute top-4 right-4 opacity-10">
              <Droplet size={120} className="text-pens-cream" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-headline)] text-2xl font-bold mb-4 text-pens-cream">Dehydration Penalty</h3>
              <p className="text-pens-cream/60 text-sm leading-relaxed mb-6">
                Vasopressin suppression has led to fluid loss. Cellular efficiency is compromised.
              </p>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-[family-name:var(--font-headline)] font-black text-pens-cream">
                  {d.dehydrationLiters > 0 ? fmt(d.dehydrationLiters) : '—'}
                </span>
                <span className="text-lg font-bold text-pens-cream/50">Liters</span>
              </div>
              <div className="flex gap-1 mt-6">
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className={`h-2 w-8 rounded-sm ${i < dehydrationBars ? 'bg-pens-crimson' : 'bg-pens-muted/30'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Editorial breakdown */}
        <section className="space-y-12 mb-20">
          <div className="border-t-2 border-pens-cream pt-8">
            <div className="flex flex-col md:flex-row md:items-start gap-8">
              <div className="md:w-1/3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-pens-crimson mb-2">Internal Audit</h4>
                <h2 className="font-[family-name:var(--font-headline)] text-4xl font-bold text-pens-cream">The Sleep Debt</h2>
              </div>
              <div className="md:w-2/3">
                <p className="text-lg text-pens-cream/80 leading-relaxed mb-6">
                  {d.sleepHours == null
                    ? 'No sleep entry for today yet — log it on the Sleep page to quantify the recovery window.'
                    : d.sleepHours < 6
                      ? `Alcohol is the great thief of REM. ${fmt(d.sleepHours)} hours in bed will not undo the damage. Cognitive capacity will be compromised through the afternoon.`
                      : `${fmt(d.sleepHours)} hours logged. Sufficient on paper — but quality matters more than quantity on a recovery day.`}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-pens-surface/60 p-4 rounded-md border border-pens-muted/20">
                    <span className="block text-[10px] uppercase font-bold opacity-60 mb-1 text-pens-cream">Sleep Hours</span>
                    <span className="font-[family-name:var(--font-headline)] text-2xl font-bold text-pens-cream">
                      {d.sleepHours != null ? fmt(d.sleepHours) + 'h' : '—'}
                    </span>
                  </div>
                  <div className="bg-pens-surface/60 p-4 rounded-md border border-pens-muted/20">
                    <span className="block text-[10px] uppercase font-bold opacity-60 mb-1 text-pens-cream">HRV</span>
                    <span className={`font-[family-name:var(--font-headline)] text-2xl font-bold ${d.hrv != null && d.hrv < 40 ? 'text-pens-crimson' : 'text-pens-cream'}`}>
                      {d.hrv != null ? fmt(d.hrv, 0) + ' ms' : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-pens-cream pt-8">
            <div className="flex flex-col md:flex-row md:items-start gap-8">
              <div className="md:w-1/3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-pens-crimson mb-2">Physiological Impact</h4>
                <h2 className="font-[family-name:var(--font-headline)] text-4xl font-bold text-pens-cream">The Endocrine Shift</h2>
              </div>
              <div className="md:w-2/3">
                <p className="text-lg text-pens-cream/80 leading-relaxed mb-6">
                  Cortisol levels peak early to compensate for the ethanol-induced slump. Glucose stability is erratic. Avoid high-glycemic inputs for the next 4 hours to prevent a complete crash.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className="px-4 py-2 bg-pens-navy text-pens-cream text-[10px] font-bold uppercase tracking-widest rounded">
                    Elevated Cortisol
                  </span>
                  <span className="px-4 py-2 bg-pens-crimson text-pens-cream text-[10px] font-bold uppercase tracking-widest rounded">
                    Insulin Resistance
                  </span>
                  <span className="px-4 py-2 bg-pens-muted/40 text-pens-cream text-[10px] font-bold uppercase tracking-widest rounded">
                    Testosterone Dip
                  </span>
                  {d.tags.includes('late_night') && (
                    <span className="px-4 py-2 bg-pens-surface text-pens-cream text-[10px] font-bold uppercase tracking-widest rounded border border-pens-muted/30">
                      Late Night
                    </span>
                  )}
                  {d.tags.includes('heavy_meal') && (
                    <span className="px-4 py-2 bg-pens-surface text-pens-cream text-[10px] font-bold uppercase tracking-widest rounded border border-pens-muted/30">
                      Heavy Meal
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="flex flex-col items-center justify-center py-12 border-y-2 border-pens-muted/20 bg-pens-surface/30 rounded-xl">
          <p className="font-[family-name:var(--font-headline)] text-2xl italic text-pens-cream/70 mb-8 text-center max-w-lg px-6">
            The numbers are in. The damage is quantified. What remains is your accountability.
          </p>
          <Link
            href="/verdict"
            className="inline-flex items-center gap-2 bg-pens-crimson text-pens-cream px-12 py-5 rounded-md font-bold uppercase tracking-[0.3em] text-sm hover:bg-pens-red active:scale-95 transition-all shadow-xl"
          >
            <Moon size={16} /> Acknowledge the Verdict
          </Link>
        </div>
      </div>
    </main>
  )
}
