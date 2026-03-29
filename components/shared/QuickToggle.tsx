'use client'

import { Zap, Settings2 } from 'lucide-react'

interface Props {
  quick: boolean
  onChange: (v: boolean) => void
}

export default function QuickToggle({ quick, onChange }: Props) {
  return (
    <div className="flex rounded-lg border border-pens-muted/30 overflow-hidden w-fit text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
          quick
            ? 'bg-pens-gold/20 text-pens-gold'
            : 'bg-transparent text-pens-cream/40 hover:text-pens-cream/70'
        }`}
      >
        <Zap size={12} />
        Quick
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors border-l border-pens-muted/30 ${
          !quick
            ? 'bg-pens-navy text-pens-cream'
            : 'bg-transparent text-pens-cream/40 hover:text-pens-cream/70'
        }`}
      >
        <Settings2 size={12} />
        Detailed
      </button>
    </div>
  )
}
