import Link from 'next/link'
import { ArrowLeft, AlertCircle, Wine, Droplet, Moon, Activity } from 'lucide-react'
import { prisma } from '@/lib/db'
import { shiftDateStr, today } from '@/lib/timeWindow'

export const dynamic = 'force-dynamic'

function fmt(n: number, digits = 1): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '—'
}

type SignalSource = 'biomarker' | 'proxy' | 'mixed' | 'none'

interface Dossier {
  date: string
  hasAlcohol: boolean
  alcoholUnits: number
  hoursSinceAlcohol: number

  ethanolOffsetKcal: number

  dehydrationLiters: number
  dehydrationSource: SignalSource
  highSodium: boolean
  hardTraining: boolean

  inflammationPct: number
  inflammationSource: SignalSource
  illnessDay: boolean

  sleepHours: number | null
  sleepQuality: number | null
  hrv: number | null
  hrvBaseline: number | null
  hrvDeviationPct: number | null   // negative = HRV dropped vs baseline (= stress)

  weeklyTrainingHours: number
  metabolicDeficitPct: number

  tags: string[]
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const m = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2
}

async function loadDossier(): Promise<Dossier> {
  const date = today()
  const baselineCutoff = shiftDateStr(date, -14)
  const weekCutoff     = shiftDateStr(date, -7)

  const [todayWeight, todaySleep, todayDay, baselineSleep, recentTrain] = await Promise.all([
    prisma.weightEntry.findFirst({ where: { date }, orderBy: { createdAt: 'desc' } }),
    prisma.sleepEntry.findUnique({ where: { date } }),
    prisma.dayEntry.findUnique({ where: { date } }),
    prisma.sleepEntry.findMany({
      where: { date: { gte: baselineCutoff, lt: date }, hrv: { not: null } },
    }),
    prisma.trainingEntry.findMany({
      where: { date: { gte: weekCutoff } },
    }),
  ])

  const alcoholUnits      = todayWeight?.alcoholUnits ?? 0
  const hoursSinceAlcohol = todayWeight?.hoursSinceAlcohol ?? 48
  const hasAlcohol        = alcoholUnits > 0 || hoursSinceAlcohol < 24
  const highSodium        = Boolean(todayWeight?.highSodium || todayWeight?.restaurantMeal)
  const hardTraining      = Boolean(todayWeight?.hardTraining)
  const illnessDay        = Boolean(todayWeight?.illnessDay)

  const sleepHours   = todaySleep?.hours ?? null
  const sleepQuality = todaySleep?.quality ?? null
  const hrv          = todaySleep?.hrv ?? null

  // ── HRV baseline ───────────────────────────────────────────────────────────
  // Need at least 4 prior nights with HRV to consider the baseline trustworthy.
  const baselineValues = baselineSleep
    .map(e => e.hrv)
    .filter((v): v is number => typeof v === 'number' && v > 0)
  const hrvBaseline = baselineValues.length >= 4 ? median(baselineValues) : null
  const hrvDeviationPct =
    hrv != null && hrvBaseline != null
      ? Math.round(((hrv - hrvBaseline) / hrvBaseline) * 100)
      : null

  // ── Recent training load ──────────────────────────────────────────────────
  // Each TrainingEntry is one exercise. We use unique-day count as a proxy for
  // sessions and estimate ~45 min per session.
  const trainDates = new Set(recentTrain.map(e => e.date))
  const weeklyTrainingHours = Math.round((trainDates.size * 0.75) * 10) / 10

  // ── Ethanol offset ────────────────────────────────────────────────────────
  // 7 kcal/g ethanol, 10 g per UK unit → 70 kcal/unit. Real arithmetic.
  const ethanolOffsetKcal = Math.round(alcoholUnits * 70)

  // ── Dehydration (litres) ──────────────────────────────────────────────────
  // Components: alcohol diuresis (~250 ml/unit), high-sodium day (~0.4 L
  // intracellular shift), hard training (~0.5 L sweat).
  const fromAlcohol = alcoholUnits * 0.25
  const fromSodium  = highSodium ? 0.4 : 0
  const fromTrain   = hardTraining ? 0.5 : 0
  const dehydrationLiters = Math.round((fromAlcohol + fromSodium + fromTrain) * 10) / 10
  const dehydrationContributors = (fromAlcohol > 0 ? 1 : 0) + (fromSodium > 0 ? 1 : 0) + (fromTrain > 0 ? 1 : 0)
  const dehydrationSource: SignalSource =
    dehydrationContributors === 0 ? 'none'
    : dehydrationContributors >= 2 ? 'mixed'
    : (highSodium || hardTraining) ? 'biomarker' : 'proxy'

  // ── Inflammation % ────────────────────────────────────────────────────────
  // HRV drop (real biomarker) carries the most weight when present;
  // alcohol units and illness flag fill in when HRV isn't available.
  const fromHrv = hrvDeviationPct != null && hrvDeviationPct < 0
    ? Math.min(45, Math.round(Math.abs(hrvDeviationPct) * 1.4))
    : 0
  const fromAlc = Math.min(20, Math.round(alcoholUnits * 3))
  const fromIll = illnessDay ? 25 : 0
  const inflammationPct = Math.min(80, fromHrv + fromAlc + fromIll)
  const inflammationContribs = (fromHrv > 0 ? 1 : 0) + (fromAlc > 0 ? 1 : 0) + (fromIll > 0 ? 1 : 0)
  const inflammationSource: SignalSource =
    inflammationPct === 0 ? 'none'
    : fromHrv > 0 && inflammationContribs >= 2 ? 'mixed'
    : fromHrv > 0 ? 'biomarker'
    : 'proxy'

  // ── Metabolic deficit % ───────────────────────────────────────────────────
  // Combines: sleep deficit (vs 8h target), HRV stress, and alcohol load.
  // If HRV is available we down-weight the crude alcohol proxy.
  const sleepDeficit = sleepHours != null ? Math.max(0, 8 - sleepHours) / 8 : 0
  const hrvStress    = hrvDeviationPct != null && hrvDeviationPct < 0
    ? Math.min(1, Math.abs(hrvDeviationPct) / 35)
    : 0
  const alcoholLoad  = Math.min(1, alcoholUnits / 8)
  const alcoholWeight = hrvDeviationPct != null ? 25 : 50
  const hrvWeight     = hrvDeviationPct != null ? 30 : 0
  const sleepWeight   = hrvDeviationPct != null ? 45 : 50
  const metabolicDeficitPct = Math.round(
    (sleepDeficit * sleepWeight + hrvStress * hrvWeight + alcoholLoad * alcoholWeight) * 10,
  ) / 10

  let tags: string[] = []
  try { tags = JSON.parse(todayDay?.tags ?? '[]') } catch {}

  return {
    date,
    hasAlcohol,
    alcoholUnits,
    hoursSinceAlcohol,
    ethanolOffsetKcal,
    dehydrationLiters,
    dehydrationSource,
    highSodium,
    hardTraining,
    inflammationPct,
    inflammationSource,
    illnessDay,
    sleepHours,
    sleepQuality,
    hrv,
    hrvBaseline,
    hrvDeviationPct,
    weeklyTrainingHours,
    metabolicDeficitPct,
    tags,
  }
}

function sourceLabel(s: SignalSource): string {
  if (s === 'biomarker') return 'HRV-derived'
  if (s === 'mixed')     return 'HRV + flags'
  if (s === 'proxy')     return 'proxy'
  return 'no signal'
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
              <p className="text-[10px] uppercase tracking-widest mt-3 opacity-50">
                {d.hrvDeviationPct != null ? 'sleep × HRV × alcohol' : 'sleep × alcohol'}
              </p>
            </div>
          </div>
        </div>

        {/* No-alcohol guard */}
        {!d.hasAlcohol && d.inflammationPct === 0 && d.dehydrationLiters === 0 && (
          <div className="mb-16 rounded-xl border border-pens-muted/20 bg-pens-surface/40 p-8 flex items-start gap-4">
            <AlertCircle size={20} className="text-pens-gold shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-pens-cream mb-1">No damage signals for today</h3>
              <p className="text-sm text-pens-cream/60 leading-relaxed">
                The Damage Audit is most informative on a hangover, illness, or high-sodium day. Numbers default to baseline — log{' '}
                <Link href="/weight" className="border-b border-pens-crimson hover:text-pens-crimson">Weight</Link>{' '}
                or{' '}
                <Link href="/sleep" className="border-b border-pens-crimson hover:text-pens-crimson">Sleep</Link>{' '}
                to populate them.
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
                {fmt(d.alcoholUnits)} units logged · 70 kcal/unit
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
                {d.inflammationSource === 'biomarker' || d.inflammationSource === 'mixed'
                  ? 'HRV is below your 14-day baseline — autonomic stress signal detected. Expect systemic sluggishness through the recovery window.'
                  : 'Elevated inflammatory markers expected from logged inputs. Expect systemic sluggishness through the recovery window.'}
              </p>
            </div>
            <div>
              <div className="text-4xl font-[family-name:var(--font-headline)] font-black text-pens-crimson">
                {d.inflammationPct > 0 ? `+${d.inflammationPct}%` : '—'}
              </div>
              <p className="text-[10px] uppercase tracking-tighter mt-4 opacity-50">
                Reactive Protein Spike · {sourceLabel(d.inflammationSource)}
              </p>
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
                {d.hardTraining || d.highSodium
                  ? `Fluid loss compounded by ${d.hardTraining ? 'training sweat' : ''}${d.hardTraining && d.highSodium ? ' and ' : ''}${d.highSodium ? 'sodium load' : ''}. Cellular efficiency is compromised.`
                  : 'Vasopressin suppression has led to fluid loss. Cellular efficiency is compromised.'}
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
              <p className="text-[10px] uppercase tracking-widest mt-3 text-pens-cream/40">
                {sourceLabel(d.dehydrationSource)}
              </p>
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
                    <span className={`font-[family-name:var(--font-headline)] text-2xl font-bold ${d.hrvDeviationPct != null && d.hrvDeviationPct < -10 ? 'text-pens-crimson' : 'text-pens-cream'}`}>
                      {d.hrv != null ? fmt(d.hrv, 0) + ' ms' : '—'}
                    </span>
                    {d.hrvBaseline != null && d.hrvDeviationPct != null && (
                      <span className="block text-[10px] mt-1 text-pens-cream/50">
                        baseline {fmt(d.hrvBaseline, 0)} ms · {d.hrvDeviationPct >= 0 ? '+' : ''}{d.hrvDeviationPct}%
                      </span>
                    )}
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
                  {d.alcoholUnits > 0 && (
                    <span className="px-4 py-2 bg-pens-navy text-pens-cream text-[10px] font-bold uppercase tracking-widest rounded">
                      Elevated Cortisol
                    </span>
                  )}
                  {d.alcoholUnits > 2 && (
                    <span className="px-4 py-2 bg-pens-crimson text-pens-cream text-[10px] font-bold uppercase tracking-widest rounded">
                      Insulin Resistance
                    </span>
                  )}
                  {d.hrvDeviationPct != null && d.hrvDeviationPct < -15 && (
                    <span className="px-4 py-2 bg-pens-crimson text-pens-cream text-[10px] font-bold uppercase tracking-widest rounded">
                      HRV Drop {d.hrvDeviationPct}%
                    </span>
                  )}
                  {d.illnessDay && (
                    <span className="px-4 py-2 bg-pens-crimson text-pens-cream text-[10px] font-bold uppercase tracking-widest rounded">
                      Illness Flag
                    </span>
                  )}
                  {d.weeklyTrainingHours >= 4 && (
                    <span className="px-4 py-2 bg-pens-navy text-pens-cream text-[10px] font-bold uppercase tracking-widest rounded">
                      Weekly Load {fmt(d.weeklyTrainingHours)}h
                    </span>
                  )}
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

          {/* Data sources strip */}
          <div className="border-t border-pens-muted/20 pt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] uppercase tracking-widest text-pens-cream/40">
            <Activity size={12} className="text-pens-cream/40" />
            <span>Sources used:</span>
            <span className={d.hrvBaseline != null ? 'text-pens-cream/70' : ''}>
              HRV {d.hrvBaseline != null ? `(14d baseline ${fmt(d.hrvBaseline, 0)}ms)` : '— need ≥4 nights'}
            </span>
            <span className={d.alcoholUnits > 0 ? 'text-pens-cream/70' : ''}>Alcohol</span>
            <span className={d.sleepHours != null ? 'text-pens-cream/70' : ''}>Sleep hours</span>
            <span className={d.weeklyTrainingHours > 0 ? 'text-pens-cream/70' : ''}>Training {fmt(d.weeklyTrainingHours)}h/wk</span>
            <span className={d.highSodium ? 'text-pens-cream/70' : ''}>Sodium flag</span>
            <span className={d.illnessDay ? 'text-pens-cream/70' : ''}>Illness flag</span>
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
