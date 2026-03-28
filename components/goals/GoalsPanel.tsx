'use client'

import { useEffect, useState } from 'react'
import { Target, X, Plus, Trash2 } from 'lucide-react'

interface Goal {
  id: string
  module: string
  metricKey: string
  targetValue: number
  startValue: number
  startDate: string
}

interface GoalWithProgress extends Goal {
  currentValue: number | null
  progressPct: number | null
  etaWeeks: number | null
}

const METRIC_CONFIG: Record<string, { label: string; unit: string; module: string; direction: 'down' | 'up' }> = {
  scaleKg:        { label: 'Target weight',            unit: 'kg', module: 'weight',       direction: 'down' },
  waistCm:        { label: 'Target waist',             unit: 'cm', module: 'measurements', direction: 'down' },
  weeklySessions: { label: 'Weekly training sessions', unit: '',   module: 'training',      direction: 'up'   },
}

interface Props {
  onClose: () => void
}

export default function GoalsPanel({ onClose }: Props) {
  const [goals, setGoals]       = useState<GoalWithProgress[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)

  const [formMetric, setFormMetric] = useState('scaleKg')
  const [formTarget, setFormTarget] = useState('')
  const [formStart, setFormStart]   = useState('')
  const [formDate, setFormDate]     = useState(new Date().toISOString().split('T')[0])

  const load = async () => {
    setLoading(true)
    try {
      const [goalsRes, dashRes] = await Promise.all([
        fetch('/api/goals').then(r => r.json()),
        fetch('/api/dashboard').then(r => r.json()),
      ])

      const rawGoals: Goal[] = Array.isArray(goalsRes) ? goalsRes : []
      const dash = dashRes ?? {}

      const latestWeightKg: number | null    = dash?.weight?.latest?.scaleKg ?? null
      const latestWaistCm: number | null     = dash?.measurements?.latest?.waistCm ?? null
      const weeklySessions: number           = dash?.training?.weekSessions ?? 0

      const getCurrentValue = (metricKey: string): number | null => {
        if (metricKey === 'scaleKg')        return latestWeightKg
        if (metricKey === 'waistCm')        return latestWaistCm
        if (metricKey === 'weeklySessions') return weeklySessions
        return null
      }

      const enriched: GoalWithProgress[] = rawGoals.map(g => {
        const currentValue = getCurrentValue(g.metricKey)

        if (currentValue == null) return { ...g, currentValue: null, progressPct: null, etaWeeks: null }

        const metaCfg = METRIC_CONFIG[g.metricKey]
        const direction = metaCfg?.direction ?? 'down'
        const totalChange = Math.abs(g.targetValue - g.startValue)
        const actualChange = direction === 'down'
          ? g.startValue - currentValue
          : currentValue - g.startValue
        const progressPct = totalChange === 0 ? 100 : Math.min(100, Math.max(0, Math.round((actualChange / totalChange) * 100)))

        const daysSinceStart = Math.max(1, Math.round((Date.now() - new Date(g.startDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)))
        const ratePerDay = actualChange / daysSinceStart
        const remaining = direction === 'down' ? currentValue - g.targetValue : g.targetValue - currentValue
        const etaWeeks = ratePerDay > 0 && remaining > 0 ? Math.ceil(remaining / (ratePerDay * 7)) : null

        return { ...g, currentValue, progressPct, etaWeeks }
      })

      setGoals(enriched)
    } catch {
      setGoals([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!formTarget || !formStart || !formDate) return
    setSaving(true)
    try {
      const cfg = METRIC_CONFIG[formMetric]
      await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: cfg.module,
          metricKey: formMetric,
          targetValue: parseFloat(formTarget),
          startValue: parseFloat(formStart),
          startDate: formDate,
        }),
      })
      setShowForm(false)
      setFormTarget(''); setFormStart('')
      setFormDate(new Date().toISOString().split('T')[0])
      await load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await fetch('/api/goals', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  const cfg = METRIC_CONFIG[formMetric]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Goals</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading && <p className="text-sm text-gray-400 text-center py-4">Loading…</p>}

          {!loading && goals.length === 0 && !showForm && (
            <p className="text-sm text-gray-400 text-center py-4">No goals set yet. Add one below.</p>
          )}

          {goals.map(goal => {
            const metaCfg = METRIC_CONFIG[goal.metricKey]
            const label   = metaCfg?.label ?? goal.metricKey
            const unit    = metaCfg?.unit  ?? ''
            return (
              <div key={goal.id} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Current:{' '}
                      <span className="font-medium text-gray-700">
                        {goal.currentValue != null ? `${goal.currentValue}${unit}` : '—'}
                      </span>
                      {'  '}→{'  '}
                      <span className="font-medium text-indigo-600">{goal.targetValue}{unit}</span>
                      {'  '}(from {goal.startValue}{unit})
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="text-gray-300 hover:text-red-400 ml-2 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {goal.progressPct != null ? (
                  <>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1.5">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all"
                        style={{ width: `${goal.progressPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{goal.progressPct}% complete</span>
                      {goal.progressPct >= 100 ? (
                        <span className="text-green-500 font-medium">Goal reached!</span>
                      ) : goal.etaWeeks != null ? (
                        <span className="text-indigo-500">~{goal.etaWeeks}w at current pace</span>
                      ) : (
                        <span className="text-gray-400">Pace not established yet</span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">No current data available.</p>
                )}
              </div>
            )
          })}

          {showForm && (
            <div className="bg-indigo-50 rounded-xl p-4 space-y-3 border border-indigo-100">
              <p className="text-sm font-semibold text-gray-700">New goal</p>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Metric</label>
                <select
                  value={formMetric}
                  onChange={e => setFormMetric(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  {Object.entries(METRIC_CONFIG).map(([key, c]) => (
                    <option key={key} value={key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Starting value{cfg.unit ? ` (${cfg.unit})` : ''}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formStart}
                    onChange={e => setFormStart(e.target.value)}
                    placeholder="e.g. 85"
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Target{cfg.unit ? ` (${cfg.unit})` : ''}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formTarget}
                    onChange={e => setFormTarget(e.target.value)}
                    placeholder="e.g. 78"
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Start date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setShowForm(false)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formTarget || !formStart}
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save goal'}
                </button>
              </div>
            </div>
          )}

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 py-2 border border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
            >
              <Plus size={14} />
              Add goal
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
