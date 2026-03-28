'use client'

import { useEffect, useState } from 'react'
import { Plane, Thermometer, Palmtree, Salad, Trophy, Tag } from 'lucide-react'

interface EventTag {
  id: string
  type: string
  label: string
  startDate: string
  endDate: string
  notes?: string | null
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; bg: string; text: string; border: string }> = {
  travel:      { icon: Plane,       bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  illness:     { icon: Thermometer, bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
  holiday:     { icon: Palmtree,    bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200' },
  'diet-break':{ icon: Salad,       bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200' },
  competition: { icon: Trophy,      bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  other:       { icon: Tag,         bg: 'bg-gray-50',   text: 'text-gray-700',   border: 'border-gray-200' },
}

function isActive(event: EventTag, today: string): boolean {
  return event.startDate <= today && event.endDate >= today
}

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}

export default function EventBanner() {
  const [activeEvents, setActiveEvents] = useState<EventTag[]>([])

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    fetch('/api/events')
      .then(r => r.json())
      .then((events: EventTag[]) => {
        setActiveEvents(events.filter(e => isActive(e, today)))
      })
      .catch(() => {})
  }, [])

  if (!activeEvents.length) return null

  return (
    <div className="space-y-2">
      {activeEvents.map(event => {
        const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.other
        const Icon = cfg.icon
        return (
          <div key={event.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
            <Icon size={15} className={`${cfg.text} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${cfg.text}`}>{event.label}</p>
              <p className={`text-xs opacity-70 ${cfg.text}`}>{formatDateRange(event.startDate, event.endDate)}</p>
              {event.notes && <p className={`text-xs mt-0.5 opacity-60 ${cfg.text}`}>{event.notes}</p>}
            </div>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} opacity-70 capitalize shrink-0`}>
              {event.type.replace('-', ' ')}
            </span>
          </div>
        )
      })}
    </div>
  )
}
