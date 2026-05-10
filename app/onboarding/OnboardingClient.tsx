'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Dumbbell, Gauge, Utensils, Moon, ArrowRight } from 'lucide-react'

const fontHeadline = 'font-[family-name:var(--font-headline)]'

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

const FLOW_STEPS = [
  {
    n: 1 as const,
    title: 'Audit The Daily Noise',
    body: 'Weight, food, and sleep give the baseline. MY PENS separates useful signal from water, sodium, carbs, and regular human chaos',
    cta: 'Start The Audit',
  },
  {
    n: 2 as const,
    title: 'Log The Evidence',
    body: 'Training, measurements, and mood show what the scale misses. Strength, shape, and mental state all get booked into the ledger',
    cta: 'Add The Receipts',
  },
  {
    n: 3 as const,
    title: 'Face The Verdict',
    body: 'Verdict audits your week, Clubroom hands out medals, and Dopamine suggests what to do when your energy account looks questionable',
    cta: 'Show The Verdict',
  },
  {
    n: 4 as const,
    title: 'Anchor Stays Private',
    body: 'Anchor is optional recovery tracking for cravings, alcohol, milestones, and notes. Private, local, non-judgmental, and always under your control',
    cta: 'Set Up Anchor',
  },
] as const

const ctaPrimaryCls =
  'inline-flex w-full items-center justify-center bg-pens-crimson px-10 py-4 font-bold uppercase tracking-widest text-pens-cream transition hover:bg-red-700 rounded-md md:w-auto'

type StepChromeProps = {
  stepIndex: 1 | 2 | 3 | 4
  onGoToStep: (n: number) => void
}

function StepChrome({ stepIndex, onGoToStep }: StepChromeProps) {
  const router = useRouter()
  const cfg = FLOW_STEPS[stepIndex - 1]
  return (
    <div className="flex min-h-screen flex-col bg-pens-deep px-6 py-10 text-pens-cream">
      <div className="flex justify-center gap-2">
        {[0, 1, 2, 3, 4].map(i => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${
              stepIndex >= 1 && i === stepIndex - 1 ? 'bg-pens-crimson' : 'bg-pens-muted/30'
            }`}
            aria-hidden
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => router.push('/')}
        className="mt-6 cursor-pointer text-center text-xs text-pens-cream/25 hover:text-pens-cream/50"
      >
        Dashboard, Before I Overthink It
      </button>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-12">
        <p className="text-xs uppercase text-pens-crimson">
          Step {cfg.n} of 4
        </p>
        <h2 className={`${fontHeadline} mt-2 text-4xl font-bold text-pens-cream`}>{cfg.title}</h2>
        <p className="mt-4 max-w-sm text-lg leading-relaxed text-pens-cream/70">{cfg.body}</p>

        <div className="mt-10 flex flex-col items-stretch gap-4">
          {stepIndex === 4 ? (
            <>
              <Link href="/" className={`${ctaPrimaryCls} text-center`}>
                {cfg.cta}
              </Link>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="text-center text-sm text-pens-cream/40 underline hover:text-pens-cream/60"
              >
                Skip For Now
              </button>
            </>
          ) : (
            <button type="button" onClick={() => onGoToStep(stepIndex + 1)} className={ctaPrimaryCls}>
              {cfg.cta}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OnboardingClient() {
  const [currentStep, setCurrentStep] = useState(0)

  const splash = (
    <>
      <div className="relative h-[442px] w-full overflow-hidden md:h-[530px]">
        <div className="absolute inset-0 bg-gradient-to-br from-pens-navy via-pens-deep to-black" />
        <div className="absolute inset-y-0 right-0 w-1/2 opacity-30 md:w-2/5 md:opacity-40">
          <Image
            src="/illustrations/gritty-portrait.png"
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 50vw, 40vw"
            className="object-cover object-[center_20%] grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-pens-deep/60 to-pens-deep" />
        </div>
        <div className="absolute top-0 left-0 h-full w-1 bg-pens-crimson" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,30,30,0.15),transparent_60%)]" />
        <div className="absolute bottom-0 left-0 z-20 h-32 w-full bg-gradient-to-t from-pens-deep to-transparent" />

        <div className="absolute top-12 left-8 z-30 md:left-16">
          <h1 className={`${fontHeadline} text-2xl font-black uppercase tracking-widest text-pens-cream`}>
            THE CONTINENTAL
          </h1>
        </div>
      </div>

      <div className="relative z-30 -mt-24 mb-20 flex-grow px-6 md:px-16 lg:px-24">
        <div className="max-w-4xl">
          <div className="mb-12">
            <span className="mb-4 block text-xs font-bold uppercase tracking-[0.3em] text-pens-crimson">
              The Initial Audit
            </span>
            <h2 className={`${fontHeadline} text-5xl font-bold leading-tight tracking-tight text-pens-cream md:text-7xl`}>
              Ready to acknowledge <br />
              the invoice?
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-pens-cream/60 md:text-xl">
              The habits of the past decade are coming due. Before we rebuild the man, we must inventory the wreckage.
            </p>
          </div>

          <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-6">
              {FIELDS.filter(f => !f.offset).map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-xl border-b-2 border-pens-muted/20 bg-pens-surface/40 p-8 backdrop-blur transition-colors duration-500 hover:border-pens-crimson"
                >
                  <div className="mb-4 flex items-center gap-4">
                    <Icon size={28} className="text-pens-crimson" />
                    <h3 className={`${fontHeadline} text-2xl font-bold italic text-pens-cream`}>{title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-pens-cream/60">{body}</p>
                </div>
              ))}
            </div>
            <div className="space-y-6 md:mt-12">
              {FIELDS.filter(f => f.offset).map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-xl border-b-2 border-pens-muted/20 bg-pens-surface/40 p-8 backdrop-blur transition-colors duration-500 hover:border-pens-crimson"
                >
                  <div className="mb-4 flex items-center gap-4">
                    <Icon size={28} className="text-pens-crimson" />
                    <h3 className={`${fontHeadline} text-2xl font-bold italic text-pens-cream`}>{title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-pens-cream/60">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-8 border-t border-pens-muted/20 pt-12 md:flex-row">
            <button type="button" onClick={() => setCurrentStep(1)} className={`${ctaPrimaryCls} shadow-[0_20px_40px_rgba(139,30,30,0.3)]`}>
              Begin the Reckoning <ArrowRight className="ml-2" size={18} />
            </button>
            <p className={`${fontHeadline} text-sm italic text-pens-cream/50 md:max-w-xs`}>
              &ldquo;Luxury is the ease of a clean conscience and a high-functioning heart.&rdquo;
            </p>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden bg-pens-deep text-pens-cream">
      {currentStep === 0 ? splash : (
        <>
          {/* StepChrome uses 1-based flow step index */}
          {currentStep === 1 && <StepChrome stepIndex={1} onGoToStep={setCurrentStep} />}
          {currentStep === 2 && <StepChrome stepIndex={2} onGoToStep={setCurrentStep} />}
          {currentStep === 3 && <StepChrome stepIndex={3} onGoToStep={setCurrentStep} />}
          {currentStep === 4 && <StepChrome stepIndex={4} onGoToStep={setCurrentStep} />}
        </>
      )}
      {/* Step 0 footnote */}
      {currentStep === 0 && (
        <>
          <div className="pointer-events-none absolute bottom-8 right-8 hidden select-none opacity-10 lg:block">
            <span className={`${fontHeadline} text-8xl font-black text-pens-cream`}>P.E.N.S.</span>
          </div>
          <div className="fixed bottom-0 z-50 h-1 w-full bg-gradient-to-r from-pens-deep via-pens-crimson to-pens-deep" />
        </>
      )}
    </main>
  )
}
