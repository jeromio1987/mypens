import Link from 'next/link'
import { Dumbbell, Gauge, Utensils, Moon, ArrowRight } from 'lucide-react'

const FIELDS = [
  {
    icon: Dumbbell,
    title: 'Performance',
    body: 'Assessing functional strength and the structural integrity of your physical frame.',
  },
  {
    icon: Gauge,
    title: 'Endurance',
    body: 'Testing the engine. How long can you sustain the pace before the redline?',
    offset: true,
  },
  {
    icon: Utensils,
    title: 'Nutrition',
    body: 'Analysing the fuel quality. Separating the necessary from the indulgent.',
  },
  {
    icon: Moon,
    title: 'Sleep',
    body: 'The foundation of recovery. Auditing the hours spent in the dark.',
    offset: true,
  },
]

export default function OnboardingPage() {
  return (
    <main className="relative min-h-screen flex flex-col bg-pens-deep text-pens-cream overflow-x-hidden">
      {/* Hero band */}
      <div className="relative w-full h-[442px] md:h-[530px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pens-navy via-pens-deep to-black" />
        {/* Crimson accent edge */}
        <div className="absolute top-0 left-0 w-1 h-full bg-pens-crimson" />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,30,30,0.15),transparent_60%)]" />
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-pens-deep to-transparent z-20" />

        <div className="absolute top-12 left-8 md:left-16 z-30">
          <h1 className="font-[family-name:var(--font-headline)] font-black uppercase tracking-widest text-pens-cream text-2xl">
            THE CONTINENTAL
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow px-6 md:px-16 lg:px-24 -mt-24 relative z-30 mb-20">
        <div className="max-w-4xl">
          <div className="mb-12">
            <span className="text-pens-crimson font-bold uppercase tracking-[0.3em] text-xs mb-4 block">
              The Initial Audit
            </span>
            <h2 className="font-[family-name:var(--font-headline)] text-5xl md:text-7xl font-bold text-pens-cream leading-tight tracking-tight">
              Ready to acknowledge <br />the invoice?
            </h2>
            <p className="mt-6 text-lg md:text-xl text-pens-cream/60 max-w-xl leading-relaxed">
              The habits of the past decade are coming due. Before we rebuild the man, we must inventory the wreckage.
            </p>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            <div className="space-y-6">
              {FIELDS.filter(f => !f.offset).map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="bg-pens-surface/40 backdrop-blur p-8 rounded-xl border-b-2 border-pens-muted/20
                             hover:border-pens-crimson transition-colors duration-500"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <Icon size={28} className="text-pens-crimson" />
                    <h3 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-pens-cream italic">
                      {title}
                    </h3>
                  </div>
                  <p className="text-pens-cream/60 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
            <div className="space-y-6 md:mt-12">
              {FIELDS.filter(f => f.offset).map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="bg-pens-surface/40 backdrop-blur p-8 rounded-xl border-b-2 border-pens-muted/20
                             hover:border-pens-crimson transition-colors duration-500"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <Icon size={28} className="text-pens-crimson" />
                    <h3 className="font-[family-name:var(--font-headline)] text-2xl font-bold text-pens-cream italic">
                      {title}
                    </h3>
                  </div>
                  <p className="text-pens-cream/60 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col md:flex-row items-center gap-8 border-t border-pens-muted/20 pt-12">
            <Link
              href="/"
              className="inline-flex items-center gap-2 w-full md:w-auto px-12 py-5 bg-pens-crimson text-pens-cream
                         font-extrabold uppercase tracking-widest rounded-md
                         hover:bg-pens-red active:scale-95 transition-all
                         shadow-[0_20px_40px_rgba(139,30,30,0.3)]"
            >
              Begin the Reckoning <ArrowRight size={18} />
            </Link>
            <p className="text-pens-cream/50 italic text-sm md:max-w-xs font-[family-name:var(--font-headline)]">
              &ldquo;Luxury is the ease of a clean conscience and a high-functioning heart.&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Footnote brand stamp */}
      <div className="absolute bottom-8 right-8 hidden lg:block opacity-10 select-none pointer-events-none">
        <span className="font-[family-name:var(--font-headline)] text-8xl font-black text-pens-cream">
          P.E.N.S.
        </span>
      </div>

      {/* Footer accent line */}
      <div className="h-1 bg-gradient-to-r from-pens-deep via-pens-crimson to-pens-deep w-full fixed bottom-0 z-50" />
    </main>
  )
}
