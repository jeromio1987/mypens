'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, Info } from 'lucide-react'

type ConfidenceLevel = 'high' | 'medium' | 'low'

interface Breakdown {
  creatineKg: number
  alcoholKg: number
  glycogenKg: number
  sodiumKg: number
  hardTrainingKg: number
  totalAdjustmentKg: number
  tanitaFlags: string[]
}

interface Props {
  scaleKg: number
  trueWeightKg: number
  confidence: ConfidenceLevel
  activeConfounders: number
  breakdown: Breakdown
}

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, {
  label: string
  bar: string
  bg: string
  border: string
  text: string
  description: string
  filled: number
}> = {
  high: {
    label: 'High confidence',
    bar: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    description: 'No active confounders — this reading is reliable.',
    filled: 3,
  },
  medium: {
    label: 'Medium confidence',
    bar: 'bg-amber-400',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    description: '1–2 factors affecting this reading — result is a plausible estimate.',
    filled: 2,
  },
  low: {
    label: 'Low confidence',
    bar: 'bg-red-400',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600',
    description: 'Multiple confounders active — treat this as a rough guide only.',
    filled: 1,
  },
}

const FACTOR_LABELS: { key: keyof Breakdown; label: string; emoji: string }[] = [
  { key: 'creatineKg',    label: 'Creatine retention',        emoji: '💊' },
  { key: 'alcoholKg',     label: 'Alcohol / water retention', emoji: '🍷' },
  { key: 'glycogenKg',    label: 'Glycogen (high-carb day)',  emoji: '🍞' },
  { key: 'sodiumKg',      label: 'Sodium / restaurant meal',  emoji: '🧂' },
  { key: 'hardTrainingKg',label: 'DOMS / hard training',      emoji: '🏋️' },
]

function ConfidenceMeter({ level }: { level: ConfidenceLevel }) {
  const cfg = CONFIDENCE_CONFIG[level]
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className={`h-2 w-6 rounded-full transition-colors ${i <= cfg.filled ? cfg.bar : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
    </div>
  )
}

export default function WeightExplanationCard({ scaleKg, trueWeightKg, confidence, activeConfounders, breakdown }: Props) {
  const [open, setOpen] = useState(false)
  const cfg = CONFIDENCE_CONFIG[confidence]
  const hasAdjustment = breakdown.totalAdjustmentKg > 0
  const diff = parseFloat((scaleKg - trueWeightKg).toFixed(2))

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <Info size={14} className={`${cfg.text} shrink-0`} />
          <div>
            <p className={`text-xs font-semibold ${cfg.text}`}>Why is my true weight different?</p>
            {!open && (
              <p className="text-xs text-gray-500 mt-0.5">
                {hasAdjustment
                  ? `${diff > 0 ? `−${diff}` : `+${Math.abs(diff)}`} kg explained by ${activeConfounders} factor${activeConfounders > 1 ? 's' : ''}`
                  : 'No active confounders — reading is clean'}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 ml-2">
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/60">
          {/* Confidence meter */}
          <div className="pt-3">
            <ConfidenceMeter level={confidence} />
            <p className="text-xs text-gray-500 mt-1.5">{cfg.description}</p>
          </div>

          {/* Breakdown table */}
          <div className="bg-white/70 rounded-xl overflow-hidden">
            <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100">
              <span className="text-xs text-gray-500">Scale reading</span>
              <span className="text-xs font-bold text-gray-800">{scaleKg} kg</span>
            </div>

            {FACTOR_LABELS.map(({ key, label, emoji }) => {
              const val = breakdown[key] as number
              if (val === 0) return null
              return (
                <div key={key} className="flex justify-between items-center px-3 py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">{emoji} {label}</span>
                  <span className="text-xs font-medium text-orange-600">−{val} kg</span>
                </div>
              )
            })}

            {!hasAdjustment && (
              <div className="px-3 py-2 border-b border-gray-100">
                <span className="text-xs text-gray-400 italic">No active retention factors</span>
              </div>
            )}

            <div className="flex justify-between items-center px-3 py-2.5 bg-gray-50">
              <span className="text-xs font-semibold text-gray-700">True weight estimate</span>
              <span className="text-sm font-bold text-gray-900">{trueWeightKg} kg</span>
            </div>
          </div>

          {/* Tanita flags */}
          {breakdown.tanitaFlags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-amber-500" />
                Scale accuracy notes
              </p>
              <ul className="space-y-1">
                {breakdown.tanitaFlags.map((flag, i) => (
                  <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0 text-amber-400">·</span>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-gray-400">
            Rule-based model · Estimates based on logged inputs · Not medical advice
          </p>
        </div>
      )}
    </div>
  )
}
