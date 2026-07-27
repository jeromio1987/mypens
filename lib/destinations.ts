/**
 * WP 1.1 — Single backbone of destinations (web).
 * Mobile mirror: mypens-mobile/lib/destinations.ts — keep labels/ids in sync.
 */

export type DestinationId = 'fueling' | 'train' | 'read' | 'audit'

export type Destination = {
  id: DestinationId
  label: string
  /** Web path */
  href: string
  /** Short blurb for “Meer” / chrome */
  blurb: string
}

/** The four primary destinations — same names on web and mobile. */
export const DESTINATIONS: readonly Destination[] = [
  { id: 'read', label: 'Read', href: '/period-review', blurb: 'What happened and what it means' },
  { id: 'fueling', label: 'Fueling', href: '/food', blurb: 'Food log and energy' },
  { id: 'train', label: 'Train', href: '/training', blurb: 'Sessions and load' },
  { id: 'audit', label: 'Audit', href: '/verdict', blurb: 'Ledgers, sync, corrections' },
] as const

export const MORE_LINKS = [
  { href: '/mode', label: 'Mode' },
  { href: '/morning-brief', label: 'Brief' },
  { href: '/weekly-feedback', label: 'Week cycle' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/integrations', label: 'Sync' },
  { href: '/weight', label: 'Weight' },
  { href: '/sleep', label: 'Sleep' },
  { href: '/anchor', label: 'Anchor' },
  { href: '/measurements', label: 'Body' },
  { href: '/bloodwork', label: 'Labs' },
  { href: '/journal', label: 'Journal' },
  { href: '/context', label: 'Context' },
  { href: '/data', label: 'Vault' },
] as const

export function destinationById(id: DestinationId): Destination {
  const d = DESTINATIONS.find(x => x.id === id)
  if (!d) throw new Error(`Unknown destination: ${id}`)
  return d
}
