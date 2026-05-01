import Link from 'next/link'
import Image from 'next/image'
import { Edit3, ArrowRight } from 'lucide-react'

const PILLARS = [
  { letter: 'P', label: 'Performance' },
  { letter: 'E', label: 'Endurance' },
  { letter: 'N', label: 'Nutrition' },
  { letter: 'S', label: 'Sleep' },
]

export default function WelcomePage() {
  return (
    <main className="min-h-screen bg-pens-deep text-pens-cream relative overflow-hidden">
      {/* Decorative blurs */}
      <div className="pointer-events-none fixed top-12 right-12 w-32 h-32 bg-pens-crimson/10 rounded-full blur-3xl" />
      <div className="pointer-events-none fixed bottom-24 left-1/4 w-64 h-64 bg-pens-navy/40 rounded-full blur-3xl" />

      <div className="flex flex-col md:flex-row min-h-screen relative">
        {/* Left: imagery / pillars */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 md:p-16 space-y-12 bg-pens-navy/30">
          {/* Mascot frame — editorial portrait */}
          <div className="relative w-full max-w-md aspect-square rounded-xl overflow-hidden flex items-end justify-center
                          bg-gradient-to-br from-pens-surface to-pens-navy
                          shadow-[0_32px_64px_rgba(0,0,0,0.4)] border border-pens-muted/20">
            <Image
              src="/illustrations/welcome-hero.png"
              alt="Lacing up — the work begins"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover object-center contrast-110"
            />
            {/* Top vignette to keep it readable on light highlights */}
            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-pens-deep/60 to-transparent pointer-events-none" />
            {/* Bottom plate w/ caption */}
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-pens-deep via-pens-deep/90 to-transparent pointer-events-none" />
            <div className="relative z-10 text-center px-8 pb-6">
              <p className="font-[family-name:var(--font-headline)] italic text-pens-cream/40 text-[10px] uppercase tracking-[0.3em] mb-2">
                The Continental
              </p>
              <p className="font-[family-name:var(--font-headline)] text-pens-cream text-5xl font-extrabold italic leading-none">
                MY PENS
              </p>
              <div className="h-px w-16 bg-pens-crimson mx-auto mt-3" />
            </div>
          </div>

          {/* PENS pillars bento */}
          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            {PILLARS.map((p, i) => (
              <div
                key={p.letter}
                className={`p-4 rounded-lg flex flex-col space-y-1 border border-pens-muted/20 ${
                  i === 0 ? 'bg-pens-surface/60' : i === 3 ? 'bg-pens-deep border-b-2 border-b-pens-crimson/40' : 'bg-pens-surface/30'
                }`}
              >
                <span className="text-pens-crimson font-bold text-xl font-[family-name:var(--font-headline)]">{p.letter}</span>
                <span className="text-xs uppercase tracking-widest text-pens-cream/50">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: content & actions */}
        <div className="w-full md:w-1/2 flex flex-col justify-center p-8 md:p-20">
          <div className="max-w-xl space-y-8">
            <div className="flex items-center space-x-2">
              <Edit3 size={20} className="text-pens-crimson" />
              <h2 className="text-2xl font-[family-name:var(--font-headline)] font-extrabold tracking-tight text-pens-cream">
                MY PENS
              </h2>
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-[family-name:var(--font-headline)] font-extrabold text-pens-cream leading-tight tracking-tight">
                READY TO MOVE <br />
                <span className="text-pens-crimson italic">YOUR PENS?</span>
              </h1>
              <p className="text-xl md:text-2xl text-pens-cream/60 font-light leading-relaxed">
                P.E.N.S. — Performance, Endurance, Nutrition, Sleep. The health companion for normal people with zero interest in biohacking or perfection.
              </p>
            </div>

            <div className="pt-10 flex flex-col space-y-6">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center gap-2 w-full md:w-max bg-pens-crimson text-pens-cream
                           px-10 py-5 rounded-xl text-lg font-bold tracking-wide uppercase
                           shadow-[0_32px_64px_rgba(139,30,30,0.3)]
                           hover:bg-pens-red active:scale-95 transition-all"
              >
                Get Moving <ArrowRight size={20} />
              </Link>

              <div className="flex items-center space-x-2">
                <span className="text-pens-cream/50 text-sm">ALREADY A MEMBER?</span>
                <Link
                  href="/"
                  className="text-pens-cream font-semibold border-b-2 border-pens-crimson hover:text-pens-crimson transition-colors text-sm"
                >
                  ENTER
                </Link>
              </div>
            </div>

            <div className="pt-20 md:pt-32">
              <div className="flex items-center space-x-4 opacity-40 hover:opacity-100 transition-opacity">
                <div className="h-px w-12 bg-pens-muted" />
                <p className="text-xs italic text-pens-cream/60">
                  Proudly optimising the Flemish &lsquo;dadbod&rsquo; since the last time we had a decent Trappist.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
