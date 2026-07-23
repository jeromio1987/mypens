'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, RotateCcw } from 'lucide-react'
import PathwayWorkspace from '@/components/pathways/PathwayWorkspace'

type Energy = 'low' | 'medium' | 'high'
type TimeSlot = 15 | 45 | 90 | 180

interface Suggestion {
  title: string
  body: string
  rule: string
}

const SUGGESTIONS: Record<Energy, Record<TimeSlot, Suggestion[]>> = {
  low: {
    15: [
      { title: 'Cold shower — right now', body: '2 minutes, door to door. Don\'t negotiate, don\'t think — just go. Fastest reset without chemicals.', rule: 'Rule: start before you close this screen.' },
      { title: 'Step outside for 10 minutes', body: 'No goal. Around the block, end of the street — doesn\'t matter. Movement and outside air do more than sitting with the feeling.', rule: 'Rule: phone stays inside.' },
    ],
    45: [
      { title: 'Walk + one full album', body: 'Pick an album you\'ve never properly listened to. Start walking. Don\'t stop until it ends. Phone in pocket, not in hand.', rule: 'Rule: no destination required.' },
      { title: 'Short ride to anywhere', body: 'Kit on, pick any direction. 20 minutes out, 20 back. The first 15 minutes always lie about how you feel.', rule: 'Rule: don\'t look at your phone until you\'re back.' },
    ],
    90: [
      { title: 'Cook something real', body: 'Pick a recipe that requires attention — not reheating, not delivery. Hands busy, brain engaged, something to show at the end.', rule: 'Rule: pick the recipe before you close this screen.' },
      { title: 'Long walk with a podcast', body: 'One long-form episode. Walk the whole thing. No sitting.', rule: 'Rule: walk, don\'t scroll.' },
    ],
    180: [
      { title: 'Walk somewhere you\'ve never been', body: 'Open Maps, pick a neighbourhood you don\'t know. Walk until you get there.', rule: 'Rule: outside, moving, no agenda.' },
      { title: 'Slow day with intention', body: 'Cook a proper meal. Listen to a full album. Read something physical.', rule: 'Rule: no alcohol, no delivery, no social media.' },
    ],
  },
  medium: {
    15: [
      { title: '20 push-ups + cold shower', body: 'Back to back, no pause. The act resets the state.', rule: 'Rule: don\'t wait until you feel like it.' },
      { title: 'Sprint to the end of the street', body: 'Full effort, twice. Back in 4 minutes.', rule: 'Rule: full effort, not jogging.' },
    ],
    45: [
      { title: 'Training session', body: 'Gym or home. Heavy compounds — 30–40 minutes that makes you breathe hard.', rule: 'Rule: decide now — gym or home?' },
      { title: 'Komoot route under 30km', body: 'Pick one. Kit on, out the door.', rule: 'Rule: kit on before you second-guess it.' },
    ],
    90: [
      { title: 'Short ride — pick a route now', body: 'Open Komoot. Under 40km. Out in 10 minutes.', rule: 'Rule: pick the route before you close this screen.' },
      { title: 'Hard gym session', body: 'Full compound programme. No scrolling between sets.', rule: 'Rule: no phone between sets.' },
    ],
    180: [
      { title: 'Explore somewhere new', body: 'Different neighbourhood or trail. Bike or on foot.', rule: 'Rule: no route planned — just a direction.' },
      { title: 'Gravel ride + real stop', body: 'Café or viewpoint halfway. Coffee or food only.', rule: 'Rule: no alcohol at the stop.' },
    ],
  },
  high: {
    15: [
      { title: 'Sprint intervals — now', body: '6 × 30 seconds all-out, 90 seconds recovery.', rule: 'Rule: all-out means all-out.' },
      { title: 'Max effort circuit', body: 'Push-ups, burpees, squats — 4 rounds.', rule: 'Rule: write down the reps.' },
    ],
    45: [
      { title: 'Hard training session', body: 'Max effort. Heavy weights, high intensity.', rule: 'Rule: no phone between sets.' },
      { title: 'Zone 2 ride', body: '30–40 min, steady. Use the energy cleanly.', rule: 'Rule: leave before you overthink.' },
    ],
    90: [
      { title: 'Hard ride — go find it', body: 'The hardest route on Komoot you haven\'t done.', rule: 'Rule: kit on before you second-guess it.' },
      { title: 'Trail run', body: 'A trail you haven\'t run. Go.', rule: 'Rule: stay present on technical sections.' },
    ],
    180: [
      { title: 'Full mission day', body: 'Long ride or trail with a real distance goal.', rule: 'Rule: plan the route in the next 2 minutes.' },
      { title: 'The ride you\'ve been postponing', body: 'The one saved for months. Today.', rule: 'Rule: send a friend the route before you leave.' },
    ],
  },
}

const ENERGY_CONFIG = {
  low: { label: 'Low', desc: 'Drained, flat, don\'t want to do anything', accent: 'text-pens-cream/60', border: 'border-pens-muted/30' },
  medium: { label: 'Medium', desc: 'Present but restless — need direction', accent: 'text-pens-gold', border: 'border-pens-gold/40' },
  high: { label: 'High', desc: 'Wired, buzzing, need somewhere to put it', accent: 'text-pens-crimson', border: 'border-pens-crimson/50' },
}

const TIME_LABELS: Record<TimeSlot, { duration: string; label: string }> = {
  15: { duration: '15', label: 'minutes' },
  45: { duration: '45', label: 'minutes' },
  90: { duration: '90', label: 'minutes' },
  180: { duration: '3h+', label: 'open-ended' },
}

type Step = 'energy' | 'time' | 'result'

export default function DopaminePage() {
  const [showNovelty, setShowNovelty] = useState(false)
  const noveltyRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<Step>('energy')
  const [energy, setEnergy] = useState<Energy | null>(null)
  const [time, setTime] = useState<TimeSlot | null>(null)
  const [altIdx, setAltIdx] = useState(0)

  function openNovelty() {
    setShowNovelty(true)
    setTimeout(() => noveltyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function pickEnergy(e: Energy) {
    setEnergy(e)
    setAltIdx(0)
    setStep('time')
  }

  function pickTime(t: TimeSlot) {
    setTime(t)
    setAltIdx(0)
    setStep('result')
  }

  function reset() {
    setEnergy(null)
    setTime(null)
    setAltIdx(0)
    setStep('energy')
  }

  const suggestion =
    energy && time ? SUGGESTIONS[energy][time][altIdx % SUGGESTIONS[energy][time].length] : null

  return (
    <main className="min-h-screen bg-pens-deep text-pens-cream font-[family-name:var(--font-geist-sans)] pb-28">
      <header className="sticky top-0 z-40 bg-pens-deep/95 backdrop-blur border-b border-pens-muted/20 px-5 py-4 flex items-center justify-between">
        <Link
          href="/anchor"
          className="flex items-center gap-1.5 text-pens-cream/60 hover:text-pens-cream transition-colors"
        >
          <ChevronLeft size={16} />
          <span className="text-xs uppercase tracking-widest font-medium">Anchor</span>
        </Link>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">Dopamine</div>
          <div className="text-sm font-semibold">Pathways</div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-pens-cream/40 hover:text-pens-cream transition-colors"
          aria-label="Reset novelty router"
        >
          <RotateCcw size={15} />
        </button>
      </header>

      <div className="px-5 pt-6 max-w-lg mx-auto">
        <PathwayWorkspace onNeedNovelty={openNovelty} />

        <div ref={noveltyRef}>
          {!showNovelty ? (
            <button
              type="button"
              onClick={openNovelty}
              className="w-full text-center text-xs text-pens-cream/30 hover:text-pens-cream/50 py-3 border-t border-pens-muted/15"
            >
              Novelty router (energy → time → move)
            </button>
          ) : (
            <div className="border-t border-pens-muted/20 pt-6 mt-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-pens-cream/40 mb-4">
                Novelty router · secondary
              </p>

              {step === 'energy' && (
                <>
                  <p className="text-pens-cream/55 text-sm leading-relaxed mb-6">
                    Two questions, one acute move — when pathways aren&apos;t enough.
                  </p>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-pens-cream/40 mb-4">
                    Energy right now?
                  </div>
                  <div className="flex flex-col gap-3">
                    {(Object.entries(ENERGY_CONFIG) as [Energy, typeof ENERGY_CONFIG.low][]).map(
                      ([key, cfg]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => pickEnergy(key)}
                          className={`w-full text-left p-5 rounded-xl bg-pens-surface/40 border ${cfg.border} hover:bg-pens-surface/60 active:scale-[0.98] transition-all`}
                        >
                          <div className={`text-lg font-bold ${cfg.accent}`}>{cfg.label}</div>
                          <div className="text-sm text-pens-cream/50 mt-1">{cfg.desc}</div>
                        </button>
                      ),
                    )}
                  </div>
                </>
              )}

              {step === 'time' && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep('energy')}
                    className="flex items-center gap-1 text-xs text-pens-cream/50 hover:text-pens-cream mb-6"
                  >
                    <ChevronLeft size={13} /> Energy
                  </button>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-pens-cream/40 mb-4">
                    Time available
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {([15, 45, 90, 180] as TimeSlot[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => pickTime(t)}
                        className="p-6 rounded-xl bg-pens-surface/40 border border-pens-muted/20 hover:bg-pens-surface/60 active:scale-95 transition-all text-center"
                      >
                        <div className="text-3xl font-bold text-pens-cream">
                          {TIME_LABELS[t].duration}
                        </div>
                        <div className="text-xs text-pens-cream/50 mt-1">{TIME_LABELS[t].label}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 'result' && suggestion && energy && time && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep('time')}
                    className="flex items-center gap-1 text-xs text-pens-cream/50 hover:text-pens-cream mb-6"
                  >
                    <ChevronLeft size={13} /> Time
                  </button>
                  <div className="inline-flex items-center gap-2 mb-4">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${ENERGY_CONFIG[energy].accent}`}
                    >
                      {ENERGY_CONFIG[energy].label}
                    </span>
                    <span className="text-pens-cream/20">·</span>
                    <span className="text-xs text-pens-cream/50">
                      {TIME_LABELS[time].duration} {TIME_LABELS[time].label}
                    </span>
                  </div>
                  <div className="rounded-2xl bg-pens-surface/60 border border-pens-crimson/30 p-6">
                    <h2 className="font-[family-name:var(--font-newsreader)] text-2xl font-bold text-pens-cream leading-tight mb-4">
                      {suggestion.title}
                    </h2>
                    <p className="text-pens-cream/70 text-sm leading-relaxed">{suggestion.body}</p>
                    <p className="text-pens-cream/40 text-xs mt-4 italic">{suggestion.rule}</p>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button
                      type="button"
                      onClick={() => setAltIdx((i) => i + 1)}
                      className="flex-1 py-3.5 rounded-xl border border-pens-muted/30 text-sm text-pens-cream/60"
                    >
                      Different one
                    </button>
                    <button
                      type="button"
                      onClick={reset}
                      className="flex-1 py-3.5 rounded-xl bg-pens-crimson text-pens-cream text-sm font-semibold"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
