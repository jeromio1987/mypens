'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Wine, UtensilsCrossed, Plane, Moon, Dumbbell } from 'lucide-react'

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

const HERO_IMAGES = [
  { src: '/illustrations/raw-1.jpg', alt: 'The Truth' },
  { src: '/illustrations/raw-2.jpg', alt: 'Basement gym' },
  { src: '/illustrations/raw-3.jpg', alt: 'The Ethanol Tax' },
]

const MODES = [
  {
    id: 'locked_in',
    label: 'Locked In',
    sublabel: 'High Intensity',
    description: 'Optimise — everything tracked, performance focus. The day is a sprint; distractions are obstacles.',
    accent: '#2E7D32',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    sublabel: 'Sustainable',
    description: 'Maintain — flexible day, social activity, no pressure. Sustainability over intensity.',
    accent: '#A87C28',
  },
  {
    id: 'off',
    label: 'Off',
    sublabel: 'Recovery',
    description: 'Rest or chaos — recovery or disruption, no friction. Surrender to the biological need for stillness.',
    accent: '#8B1E1E',
  },
]

const TAGS = [
  { id: 'alcohol',          label: 'Alcohol',       Icon: Wine },
  { id: 'heavy_meal',       label: 'Heavy meal',    Icon: UtensilsCrossed },
  { id: 'travel',           label: 'Travel',        Icon: Plane },
  { id: 'late_night',       label: 'Late night',    Icon: Moon },
  { id: 'intense_training', label: 'Hard training', Icon: Dumbbell },
]

const C = {
  bg:      '#0E0B09',
  surface: '#1C1713',
  border:  '#2A2520',
  text:    '#EDE8DF',
  muted:   'rgba(237,232,223,0.35)',
  dim:     'rgba(237,232,223,0.18)',
  accent:  '#C4381A',
}

export default function DesignPreviewPage() {
  const [hero, setHero] = useState<typeof HERO_IMAGES[0] | null>(null)

  useEffect(() => {
    setHero(HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)])
  }, [])
  const [active, setActive] = useState<string[]>([])

  const toggle = (id: string) =>
    setActive(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])

  return (
    <main style={{ backgroundColor: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'var(--font-geist-sans)' }}>

      {/* Grain layer */}
      <div aria-hidden style={{
        position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none',
        backgroundImage: GRAIN_SVG, backgroundSize: '160px 160px', opacity: 0.045,
      }} />

      {/* ─── Header ─── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        backgroundColor: C.bg, borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
            Auditor
          </span>
          <nav style={{ display: 'flex', gap: 32 }}>
            {['Brief', 'Investing', 'Dashboard', 'Vault'].map(l => (
              <span key={l} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, cursor: 'pointer' }}>{l}</span>
            ))}
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.accent }}>Mode</span>
          </nav>
        </div>
      </header>

      {/* ─── HERO: full-bleed split ─── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 42%', minHeight: '88vh', borderBottom: `1px solid ${C.border}` }}>

        {/* Left: text */}
        <div style={{
          padding: '72px 64px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          borderRight: `1px solid ${C.border}`,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 32 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.accent }}>
                Entry 134
              </span>
              <span style={{ fontSize: 11, color: C.dim }}>
                Wednesday, 14 May 2026 — 07:32
              </span>
            </div>

            <h1 style={{
              fontFamily: 'var(--font-barlow)',
              fontWeight: 900,
              fontSize: 'clamp(72px, 9vw, 120px)',
              lineHeight: 0.88,
              letterSpacing: '-0.04em',
              textTransform: 'uppercase',
              color: C.text,
              margin: 0,
            }}>
              Today&apos;s<br />Intent
            </h1>
          </div>

          <div>
            <div style={{ width: 48, height: 2, backgroundColor: C.accent, marginBottom: 24 }} />
            <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.7, maxWidth: 400, marginBottom: 48 }}>
              Before the chaos of the world intervenes, define the scope of your output. Choose a frequency and commit to the ledger.
            </p>

            {/* Footer ledger inside hero */}
            <div style={{ display: 'flex', gap: 56, borderTop: `1px solid ${C.border}`, paddingTop: 28 }}>
              {[
                { label: 'Current Streak', value: '5', unit: 'Days' },
                { label: 'Mental Load',    value: 'High', unit: '' },
              ].map(stat => (
                <div key={stat.label}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, marginBottom: 4 }}>
                    {stat.label}
                  </p>
                  <p style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 40, lineHeight: 1, letterSpacing: '-0.03em', color: C.text, margin: 0 }}>
                    {stat.value}
                    {stat.unit && <span style={{ fontSize: 14, fontWeight: 400, color: C.muted, marginLeft: 5 }}>{stat.unit}</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: full-bleed photo */}
        <div style={{ position: 'relative', overflow: 'hidden', backgroundColor: C.surface }}>
          {hero && (
            <>
              <Image
                src={hero.src}
                alt={hero.alt}
                fill
                priority
                sizes="42vw"
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center',
                  filter: 'contrast(1.08) grayscale(0.05)',
                }}
              />
              {/* subtle dark vignette on left edge */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, rgba(14,11,9,0.35) 0%, transparent 25%)',
              }} />
              {/* caption bottom-right */}
              <div style={{
                position: 'absolute', bottom: 20, right: 20,
                fontSize: 9, fontWeight: 700, letterSpacing: '0.2em',
                textTransform: 'uppercase', color: 'rgba(237,232,223,0.4)',
              }}>
                {hero.alt}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ─── Body content ─── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 24px 120px' }}>

        {/* ─── Mode selection ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', border: `1px solid ${C.border}`, marginBottom: 64 }}>

          {/* Primary */}
          <div style={{
            borderRight: `1px solid ${C.border}`,
            borderLeft: `4px solid ${MODES[0].accent}`,
            padding: '40px 40px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            minHeight: 420, cursor: 'pointer',
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dim }}>
                  {MODES[0].sublabel}
                </span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: MODES[0].accent, display: 'block' }} />
              </div>
              <div style={{
                fontFamily: 'var(--font-barlow)', fontWeight: 900,
                fontSize: 'clamp(48px, 5vw, 72px)', lineHeight: 0.9,
                letterSpacing: '-0.03em', textTransform: 'uppercase', color: C.text, marginBottom: 20,
              }}>
                Locked<br />In
              </div>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, maxWidth: 260 }}>
                {MODES[0].description}
              </p>
            </div>
            <div style={{ paddingTop: 24, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, marginBottom: 6 }}>P.E.N.S. Priority</p>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0,1,2,3].map(i => <div key={i} style={{ width: 20, height: 3, backgroundColor: MODES[0].accent }} />)}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.accent }}>
                Select State →
              </span>
            </div>
          </div>

          {/* Secondary modes */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[MODES[1], MODES[2]].map((m, idx) => (
              <div key={m.id} style={{
                flex: 1, padding: '28px 36px',
                borderBottom: idx === 0 ? `1px solid ${C.border}` : undefined,
                borderLeft: `4px solid ${m.accent}`,
                cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 24,
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.dim, display: 'block', marginBottom: 8 }}>
                    {m.sublabel}
                  </span>
                  <div style={{
                    fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 40,
                    lineHeight: 0.9, letterSpacing: '-0.02em', textTransform: 'uppercase',
                    color: C.text, marginBottom: 10,
                  }}>
                    {m.label}
                  </div>
                  <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.65 }}>{m.description}</p>
                </div>
                <span style={{ color: C.dim, marginTop: 4, fontSize: 16 }}>→</span>
              </div>
            ))}
            <div style={{ padding: '24px 36px', backgroundColor: C.surface, borderTop: `1px solid ${C.border}` }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.accent, marginBottom: 8 }}>
                The Auditor&apos;s Note
              </p>
              <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, fontStyle: 'italic' }}>
                &ldquo;Indecision is the silent killer of performance. If you cannot decide, you have already chosen &lsquo;Off&rsquo;. We track for clarity, not punishment.&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* ─── Context tags ─── */}
        <div style={{ marginBottom: 64 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.dim, marginBottom: 14 }}>
            Context — optional
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TAGS.map(({ id, label, Icon }) => {
              const isActive = active.includes(id)
              return (
                <button key={id} onClick={() => toggle(id)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px', fontSize: 12, fontWeight: 500,
                  color: isActive ? C.text : C.muted,
                  border: `1px solid ${isActive ? C.accent : C.border}`,
                  backgroundColor: isActive ? `${C.accent}18` : 'transparent',
                  cursor: 'pointer', letterSpacing: '0.03em', transition: 'all 0.15s',
                }}>
                  <Icon size={13} color={isActive ? C.accent : C.muted} strokeWidth={1.5} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── Quote footer ─── */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 11, color: C.dim, fontStyle: 'italic' }}>
            &ldquo;The difference between a gentleman and a vagabond is a schedule.&rdquo;
          </p>
          <div style={{ display: 'flex', gap: 24 }}>
            <Link href="/" style={{ fontSize: 11, color: C.dim, textDecoration: 'none' }}>← Current Home</Link>
            <Link href="/dashboard" style={{ fontSize: 11, color: C.dim, textDecoration: 'none' }}>Dashboard →</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
