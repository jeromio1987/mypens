/** Habit pathway catalog — educational circuits, not receptor assays. */

export type PathwayKind = 'break' | 'build'

export type PathwayId =
  | 'cue'
  | 'relief'
  | 'alcSleep'
  | 'start'
  | 'sleepHead'
  | 'natural'
  | 'arousal'

export interface PathwayDef {
  id: PathwayId
  kind: PathwayKind
  short: string
  title: string
  move: string
  lag: string
}

export const PATHWAYS: PathwayDef[] = [
  {
    id: 'cue',
    kind: 'break',
    short: 'Cue → urge → use',
    title: 'Cue → urge → use',
    move: 'Pick your top cue. Pre-commit one replacement + one person who knows.',
    lag: 'Weeks–months if cues are not reinforced; ghosts can last 1+ year.',
  },
  {
    id: 'relief',
    kind: 'break',
    short: 'Stress → relief use',
    title: 'Stress / hangover → relief use',
    move: 'When urge hits: write the feeling in 3 words before any drink.',
    lag: 'Weeks–months with supports; spikes again under load.',
  },
  {
    id: 'alcSleep',
    kind: 'break',
    short: 'Alcohol → sleep cut',
    title: 'Evening alcohol → thin headroom',
    move: 'One non-negotiable last-drink clock for 14 nights.',
    lag: 'Sleep often improves in days–2 weeks after cutting late drinks.',
  },
  {
    id: 'start',
    kind: 'build',
    short: 'Scaffold → start',
    title: 'External scaffold → start → finish',
    move: 'Tomorrow: one task on paper before unlocking the phone.',
    lag: '1–3 weeks to feel habit-like; scaffold stays long-term.',
  },
  {
    id: 'sleepHead',
    kind: 'build',
    short: 'Sleep → headroom',
    title: 'Protected sleep → next-day headroom',
    move: 'Fix wake time for 7 days. Defend the hours before it.',
    lag: 'Days–2 weeks for subjective headroom.',
  },
  {
    id: 'natural',
    kind: 'build',
    short: 'Practice → natural reward',
    title: 'Small practice → natural reward',
    move: '3× this week: 20+ min training or a real social meal.',
    lag: 'Often months to ~1–2 years with reduced use.',
  },
  {
    id: 'arousal',
    kind: 'build',
    short: 'Dosed arousal → regulate',
    title: 'Cold / HIIT → regulated arousal',
    move: 'Two cold showers this week (1–2 min). Tag them in Anchor notes if useful.',
    lag: 'Acute minutes–hours; confidence over weeks of reps.',
  },
]

export function pathwayById(id: string): PathwayDef | undefined {
  return PATHWAYS.find((p) => p.id === id)
}

export function breakPathways(): PathwayDef[] {
  return PATHWAYS.filter((p) => p.kind === 'break')
}

export function buildPathways(): PathwayDef[] {
  return PATHWAYS.filter((p) => p.kind === 'build')
}

export const FOCUS_STORAGE_KEY = 'mypens_pathway_focus_v1'
