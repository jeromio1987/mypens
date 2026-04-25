'use client'

import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Circle, Clock, Rocket } from 'lucide-react'

const PHASES = [
  { num: 1, name: 'Foundation',       timing: 'Week 1',              status: 'done'    },
  { num: 2, name: 'Trust MVP',        timing: 'Weeks 2–3',           status: 'done'    },
  { num: 3, name: 'Convenience',      timing: 'Weeks 4–6',           status: 'upcoming'},
  { num: 4, name: 'Scale & Monetize', timing: 'Later, if earned',    status: 'future'  },
]

const PHASE_GOALS: Record<number, string> = {
  1: 'Prove the core fast',
  2: 'Make daily use feel good',
  3: 'Add convenience without clutter',
  4: 'Expand only when earned',
}

type PhaseStatus = 'done' | 'upcoming' | 'future'

const PHASE_STYLES: Record<PhaseStatus, { badge: string; col: string; border: string; header: string }> = {
  done:     {
    badge:  'bg-emerald-900/40 text-emerald-300 border border-emerald-500/30',
    col:    'bg-emerald-900/10',
    border: 'border-emerald-500/20',
    header: 'text-emerald-300',
  },
  upcoming: {
    badge:  'bg-pens-crimson/20 text-pens-cream border border-pens-crimson/40',
    col:    'bg-pens-crimson/5',
    border: 'border-pens-crimson/30',
    header: 'text-pens-gold',
  },
  future:   {
    badge:  'bg-pens-muted/20 text-pens-cream/40 border border-pens-muted/30',
    col:    'bg-pens-navy/20',
    border: 'border-pens-muted/20',
    header: 'text-pens-cream/40',
  },
}

const PHASE_ICONS: Record<PhaseStatus, React.ElementType> = {
  done:     CheckCircle2,
  upcoming: Clock,
  future:   Rocket,
}

interface TrackPhase {
  focus: string
  deliverables: string
}

interface Track {
  num: number
  name: string
  objective: string
  successLooks: string
  phases: TrackPhase[]
}

const TRACKS: Track[] = [
  {
    num: 1,
    name: 'Development',
    objective: 'Create one canonical timeline of user data, then layer interpretation on top. Every data point preserves source, editability and confidence.',
    successLooks: 'Stable engine explaining noisy weigh-ins. Reliable source provenance. Clean rule for local vs remote.',
    phases: [
      { focus: 'Data foundation',       deliverables: 'Canonical schema (weight, events, workouts, notes), manual entry with edit history, source provenance tags, import mapping' },
      { focus: 'Interpretation engine', deliverables: 'Adjustment logic v1 with visible assumptions, confidence layer, explanation snippets, backtest harness' },
      { focus: 'Quality & analytics',   deliverables: 'Event attribution review tools, internal QA dashboards, retention and usage instrumentation' },
      { focus: 'Scalable architecture', deliverables: 'Modular sync/insights boundaries, premium-ready feature flags, selective hosted infra' },
    ],
  },
  {
    num: 2,
    name: 'Mobile + Design',
    objective: 'Light, calm, understandable for ordinary trackers. Reduce interpretation anxiety.',
    successLooks: 'User logs in seconds. Post-trip moment feels reassuring. App teaches without feeling technical.',
    phases: [
      { focus: 'Flow design',      deliverables: 'Mobile-first entry/review/edit, home screen (today + trend + explanation), trip/event mode' },
      { focus: 'Trust surfaces',   deliverables: 'Confidence meter, adjusted-vs-raw comparison, explanation cards, "what changed / what matters" hierarchy' },
      { focus: 'Retention polish', deliverables: 'Reminders, streaks, nudges, saved habits, one-tap event tagging, better empty states' },
      { focus: 'Premium UX depth', deliverables: 'Advanced filters, source controls, longer-view reports, multi-device sync settings' },
    ],
  },
  {
    num: 3,
    name: 'Legal & Data Governance',
    objective: 'Informed consent, minimal data collection, clear vendor boundaries, conservative health-adjacent handling.',
    successLooks: 'Users understand what\'s collected. Vendor terms don\'t force brittle workarounds. Privacy is a trust advantage.',
    phases: [
      { focus: 'Baseline readiness',      deliverables: 'Privacy policy, terms, in-app consent flows, health disclaimer, data map and retention logic' },
      { focus: 'Compliance depth',        deliverables: 'GDPR review, controller/processor mapping, DPIA-style risk review, incident response and deletion' },
      { focus: 'Integration guardrails',  deliverables: 'Review Apple/Google broker permissions, Strava/vendor terms matrix, no scraping' },
      { focus: 'Expansion readiness',     deliverables: 'Counsel review before direct health integrations, partner-grade handling, hosted sync security audit' },
    ],
  },
  {
    num: 4,
    name: 'Branding & GTM',
    objective: 'Position MY PENS as a premium interpretation product — not a generic wellness app, not a biohacker toy.',
    successLooks: 'A stranger understands the value in one sentence. First users know whether it\'s for them.',
    phases: [
      { focus: 'Message foundation', deliverables: 'Refine promise (raw weight vs useful signal), audience language, landing page, first proof story' },
      { focus: 'Narrative fit',      deliverables: 'Trip rebound walkthrough, before/after screenshots, trust language (no pseudo-science)' },
      { focus: 'Acquisition loops',  deliverables: 'Creator/coach seeding, referral hooks, email onboarding, habit education' },
      { focus: 'Commercial framing', deliverables: 'Clear free vs paid structure, partnership stories, investor-ready traction narrative' },
    ],
  },
  {
    num: 5,
    name: 'Integrations',
    objective: 'Manual first. One internal data model. External sources suggest data into it. Users stay in control.',
    successLooks: 'High-value import coverage. Clear source trust hierarchy. Integrations support the wedge — don\'t bloat the product.',
    phases: [
      { focus: 'Manual first',         deliverables: 'Fast manual entry (weight + body metrics), CSV import/export basics, source labels and override rules' },
      { focus: 'Broker integrations',  deliverables: 'Apple HealthKit + Android Health Connect (read only), cross-source mapping (workouts, sleep, weight)' },
      { focus: 'Direct convenience',   deliverables: 'Strava direct for workouts/context, Garmin evaluated post-broker, import review screens for duplicates' },
      { focus: 'Selective expansion',  deliverables: 'Tanita via approved route, deeper vendor deals only when retention supports it' },
    ],
  },
]

const NEXT_30_DAYS = [
  'Lock core schema and adjustment v1',
  'Polish the mobile trust loop and trip flow',
  'Ship privacy baseline and review pack',
  'Start HealthKit / Health Connect evaluation',
]

const GAPS = [
  'Tech stack decisions — what language/framework for mobile? React Native? Swift/Kotlin native?',
  'Solo vs team — who is building this? Are you coding it yourself or directing AI/developers?',
  'Monetization model — freemium tiers not yet defined (what\'s free, what\'s paid, price points)',
  'Data model spec — the canonical schema is named but not designed (field names, types, relationships)',
  'Adjustment logic spec — "adjustment v1" is referenced but algorithm not defined',
  'MVP scope cut — Phase 2 deliverables are still broad; what is the absolute minimum to ship?',
  'Design language — no visual identity yet (colors, typography, UI tone)',
  'Name / domain — is "MY PENS" final? Is a domain available?',
  'Metrics / success KPIs — retention targets, engagement benchmarks not defined',
]

export default function RoadmapClient() {
  return (
    <main className="min-h-screen bg-pens-deep px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-pens-cream/40 hover:text-pens-cream/70 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-pens-crimson font-semibold">P.E.N.S.</p>
            <h1 className="text-2xl font-bold text-pens-cream mt-0.5">Product Roadmap</h1>
            <p className="text-xs text-pens-cream/40 mt-0.5">4 phases · 5 tracks · updated March 2026</p>
          </div>
        </div>

        {/* Phase overview */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PHASES.map(phase => {
            const styles = PHASE_STYLES[phase.status as PhaseStatus]
            const Icon = PHASE_ICONS[phase.status as PhaseStatus]
            return (
              <div key={phase.num} className={`rounded-2xl border p-4 ${styles.col} ${styles.border}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon size={13} className={styles.header} />
                  <span className={`text-xs font-semibold ${styles.header}`}>Phase {phase.num}</span>
                </div>
                <p className="font-semibold text-pens-cream text-sm leading-tight mb-1">{phase.name}</p>
                <p className="text-xs text-pens-cream/40 mb-2">{phase.timing}</p>
                <p className="text-xs text-pens-cream/50 italic leading-snug">{PHASE_GOALS[phase.num]}</p>
                <span className={`inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${styles.badge}`}>
                  {phase.status === 'done' ? 'Done' : phase.status === 'upcoming' ? 'In progress' : 'Future'}
                </span>
              </div>
            )
          })}
        </div>

        <p className="text-xs text-pens-cream/40 -mt-4 px-1 italic">
          Strategic call: One app, two depths — simple by default, advanced by choice. Do not split into two apps yet.
        </p>

        {/* Tracks */}
        <div className="space-y-6">
          <h2 className="font-semibold text-pens-cream/70 text-sm px-1 uppercase tracking-widest">Development Tracks</h2>

          {TRACKS.map(track => (
            <div key={track.num} className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-pens-muted/20">
                <p className="text-[10px] font-semibold text-pens-crimson uppercase tracking-widest mb-0.5">Track {track.num}</p>
                <h3 className="font-bold text-pens-cream">{track.name}</h3>
                <p className="text-xs text-pens-cream/50 mt-1 leading-relaxed">{track.objective}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-pens-muted/10">
                {track.phases.map((tp, idx) => {
                  const phase = PHASES[idx]
                  const styles = PHASE_STYLES[phase.status as PhaseStatus]
                  return (
                    <div key={idx} className={`p-4 ${styles.col}`}>
                      <div className="flex items-center gap-1 mb-1">
                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${styles.header}`}>
                          Ph {phase.num}
                        </span>
                        {phase.status === 'done' && <CheckCircle2 size={10} className="text-emerald-400" />}
                      </div>
                      <p className="text-xs font-semibold text-pens-cream/80 mb-1.5">{tp.focus}</p>
                      <p className="text-[11px] text-pens-cream/50 leading-relaxed">{tp.deliverables}</p>
                    </div>
                  )
                })}
              </div>

              <div className="px-5 py-3 bg-pens-navy/40 border-t border-pens-muted/20">
                <p className="text-[11px] text-pens-cream/40">
                  <span className="font-semibold text-pens-cream/60">Success: </span>
                  {track.successLooks}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Next 30 Days */}
        <div className="bg-pens-crimson/10 border border-pens-crimson/30 rounded-2xl p-5">
          <h2 className="font-bold text-pens-cream mb-3 flex items-center gap-2">
            <Clock size={16} className="text-pens-crimson" />
            Next 30 Days — Priority Order
          </h2>
          <ol className="space-y-2">
            {NEXT_30_DAYS.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-pens-crimson/30 text-pens-cream text-xs font-bold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <span className="text-sm text-pens-cream/80">{item}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Gaps to fill */}
        <div className="bg-pens-surface/80 border border-pens-muted/20 rounded-2xl p-5">
          <h2 className="font-bold text-pens-cream mb-1">Gaps to Fill</h2>
          <p className="text-xs text-pens-cream/40 mb-4">Open items this roadmap does not yet cover.</p>
          <ul className="space-y-2.5">
            {GAPS.map((gap, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <Circle size={14} className="text-pens-cream/30 shrink-0 mt-0.5" />
                <span className="text-sm text-pens-cream/60 leading-relaxed">{gap}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-pens-cream/30 text-center pb-4 italic">
          Roadmap version: revised — exported March 2026
        </p>
      </div>
    </main>
  )
}
