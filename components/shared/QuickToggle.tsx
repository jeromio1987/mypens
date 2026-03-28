'use client'

import { Zap, Settings2 } from 'lucide-react'

interface Props {
  quick: boolean
  onChange: (v: boolean) => void
}

export default function QuickToggle({ quick, onChange }: Props) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
          quick ? 'bg-amber-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
        }`}
      >
        <Zap size={12} />
        Quick
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors border-l border-gray-200 ${
          !quick ? 'bg-gray-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
        }`}
      >
        <Settings2 size={12} />
        Detailed
      </button>
    </div>
  )
}
