/**
 * Continental Editorial — live preview of the Stitch design system.
 *
 * Deliberately static (no Prisma) so it renders with the database down.
 * Every figure is a placeholder; every card names the real code path that
 * would fill it. Fictional metrics from the Stitch comps (Dopamine Tax,
 * Synaptic Misfire Risk, Cognitive Debt) are NOT reproduced — nothing in the
 * schema can compute them, and docs/ANALYSIS-FORMULAS.md forbids inventing them.
 */
import {
  Action,
  Band,
  Binding,
  BottomNav,
  Card,
  Display,
  Kicker,
  LedgerRow,
  Masthead,
  Metric,
  SpecimenBar,
} from '@/components/continental/kit'

export const metadata = { title: 'Continental — design preview' }

/** Real modules, fictional numbers. Each entry carries its binding. */
const DISRUPTIONS = [
  { label: 'Late night', sub: 'Bedtime outside declared window', value: '02:14', binding: 'SleepEntry.bedtime' },
  { label: 'Ethanol', sub: 'Units logged against the reset baseline', value: '—', binding: 'WeightEntry.alcoholUnits' },
  { label: 'Load peak', sub: 'Intensity-weighted session load', value: '—', binding: 'trainingLoad.dayTrainingLoad()' },
]

const VERDICT_ROWS = [
  { label: 'Performance', sub: 'Load vs recovery window', value: 'Unbound', binding: 'scripts/lib/trainingLoad.mjs' },
  { label: 'Endurance', sub: 'No module — see gap list', value: 'Missing', tone: 'blood' as const, binding: '(none)' },
  { label: 'Nutrition', sub: 'Coverage-gated macro totals', value: 'Unbound', binding: 'lib/energyBalance.ts' },
  { label: 'Sleep', sub: 'Duration + regularity', value: 'Unbound', binding: 'lib/readinessMetrics.ts' },
]

export default function ContinentalPreview() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-ct-lowest">
      <Masthead caseId="Case study · design specimen" />
      <SpecimenBar />

      {/* ── Command Center (comp 01) ───────────────────────────── */}
      <Band tier="low">
        <Kicker className="mb-6 border-l-2 border-ct-blood pl-3">Biological status</Kicker>
        <Metric
          label="Metric · Energy delta"
          value="—"
          unit="kcal"
          note="Food minus (BMR + EAT + NEAT). Device estimates, not metabolic TDEE."
          binding="getDayEnergyBalance().delta"
        />
        <Metric
          label="Metric · Coverage"
          value="—"
          unit="/ 7 d"
          note="Days with food actually logged. Gates every downstream claim."
          binding="audit S1 — proposed foodDaysLogged"
        />
        <Metric
          label="Metric · Readiness"
          value="—"
          unit="/ 100"
          tone="blood"
          note="Sleep duration and quality. Partial when HRV is absent."
          binding="computeSleepScore(hours, quality)"
        />
      </Band>

      {/* ── Reconciliation (comp 04) ───────────────────────────── */}
      <Band tier="lowest">
        <Card tier="high">
          <p className="font-headline text-3xl leading-none tracking-[-0.02em] text-ct-primary">
            The
            <br />
            Reconciliation
          </p>
          <p className="mt-3 text-[0.8rem] leading-relaxed text-ct-second/70">
            The scale moves for reasons that are not fat. Water, glycogen and sodium are
            modelled out before anything is called a trend.
          </p>
          <div className="mt-7 flex gap-10">
            <div>
              <Kicker>True weight</Kicker>
              <p className="mt-1 font-headline text-4xl text-ct-primary">
                — <span className="font-grotesk text-sm text-ct-second/60">kg</span>
              </p>
            </div>
            <div>
              <Kicker>Variance</Kicker>
              <p className="mt-1 font-headline text-4xl text-ct-bloodon">—</p>
            </div>
          </div>
          <Binding path="WeightEntry.trueWeightKg · lib/retentionModels.ts" />
        </Card>
      </Band>

      {/* ── Disruptions (comp 01) ──────────────────────────────── */}
      <Band tier="low" className="px-0">
        <Kicker className="mb-5 px-6">Disruptions · 72h window</Kicker>
        {DISRUPTIONS.map((d, i) => (
          <LedgerRow key={d.label} index={i} label={d.label} sub={d.sub} value={d.value} />
        ))}
        <p className="px-6 pt-5 font-grotesk text-[0.5625rem] uppercase tracking-[0.14em] text-ct-second/45">
          ↳ DayEntry.tags · WeightEntry.alcoholUnits · trainingLoad
        </p>
      </Band>

      {/* ── Cost of a night (METRICS-EXPANSION §8) ─────────────── */}
      <Band tier="lowest">
        <Card tier="blood">
          <p className="font-headline text-2xl text-ct-blood">The Ethanol Tax</p>
          <p className="mt-3 text-[0.8rem] leading-relaxed text-ct-blood/80">
            One bundle: next-day resting HR, HRV, sleep efficiency, craving count and euro
            cost. Descriptive — it reports what followed, never what will happen.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-y-5">
            {['RHR delta', 'HRV delta', 'Sleep efficiency', 'Cravings logged'].map(k => (
              <div key={k}>
                <p className="font-grotesk text-[0.5625rem] uppercase tracking-[0.16em] text-ct-blood/60">{k}</p>
                <p className="font-headline text-2xl text-ct-blood">—</p>
              </div>
            ))}
          </div>
          <Binding path="GarminDailyMetric · CravingEvent · RecoverySettings.drinkCostEur" />
        </Card>
      </Band>

      {/* ── Verdict (comp 05) ──────────────────────────────────── */}
      <Band tier="low" className="px-0">
        <div className="px-6">
          <Kicker>Weekly reconciliation</Kicker>
          <Display className="mt-3">
            The
            <br />
            Auditor&rsquo;s
            <br />
            Verdict.
          </Display>
          <div className="mt-5 h-px w-16 bg-ct-blood" />
          <p className="mt-7 mb-6 font-headline text-lg italic leading-snug text-ct-second/80">
            &ldquo;A ledger only balances against what was actually logged.&rdquo;
          </p>
        </div>
        {VERDICT_ROWS.map((r, i) => (
          <LedgerRow key={r.label} index={i} label={r.label} sub={r.sub} value={r.value} tone={r.tone} />
        ))}
      </Band>

      {/* ── Gap list — answers "which module is missing" ───────── */}
      <Band tier="lowest">
        <Kicker>Design coverage</Kicker>
        <p className="mt-3 mb-6 text-[0.8rem] leading-relaxed text-ct-second/70">
          Five comps delivered. The five-tab nav needs two more before this system can
          replace the current shell.
        </p>
        <div className="space-y-px">
          <LedgerRow index={0} label="Nutrition" sub="No comp — /food is the daily driver" value="Needed" tone="blood" />
          <LedgerRow index={1} label="Endurance" sub="No comp — tab has no route at all" value="Needed" tone="blood" />
          <LedgerRow index={2} label="Command center" sub="Comp 01" value="Have" />
          <LedgerRow index={3} label="Sleep" sub="Comp 02" value="Have" />
          <LedgerRow index={4} label="Performance" sub="Comp 03" value="Have" />
          <LedgerRow index={5} label="Reconciliation" sub="Comp 04" value="Have" />
          <LedgerRow index={6} label="Verdict" sub="Comp 05" value="Have" />
        </div>
      </Band>

      <Band tier="low">
        <Action tone="primary">Initiate audit</Action>
        <p className="mt-4 text-center font-grotesk text-[0.5625rem] uppercase tracking-[0.14em] text-ct-second/45">
          0px radius · no dividers · oxblood used once
        </p>
      </Band>

      <BottomNav active="audit" />
    </main>
  )
}
