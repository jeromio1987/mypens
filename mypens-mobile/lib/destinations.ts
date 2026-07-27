/**
 * WP 1.1 — Single backbone of destinations (mobile).
 * Web mirror: lib/destinations.ts — keep labels/ids in sync.
 */

export type DestinationId = 'fueling' | 'train' | 'read' | 'audit'

export type Destination = {
  id: DestinationId
  label: string
  /** Expo Router href inside (tabs) */
  href: '/(tabs)/food' | '/(tabs)/training' | '/(tabs)/read' | '/(tabs)/audit'
  blurb: string
}

export const DESTINATIONS: readonly Destination[] = [
  { id: 'read', label: 'Read', href: '/(tabs)/read', blurb: 'What happened and what it means' },
  { id: 'fueling', label: 'Fueling', href: '/(tabs)/food', blurb: 'Food log and energy' },
  { id: 'train', label: 'Train', href: '/(tabs)/training', blurb: 'Sessions and load' },
  { id: 'audit', label: 'Audit', href: '/(tabs)/audit', blurb: 'Ledgers, sync, corrections' },
] as const

/** Hidden capture routes — reachable from Audit, not the tab bar. */
export const AUDIT_CAPTURE_ROUTES = [
  { href: '/(tabs)/index' as const, label: 'Weight entry' },
  { href: '/(tabs)/sleep' as const, label: 'Sleep entry' },
  { href: '/(tabs)/measurements' as const, label: 'Body' },
  { href: '/(tabs)/journal' as const, label: 'Journal' },
] as const

export function destinationById(id: DestinationId): Destination {
  const d = DESTINATIONS.find(x => x.id === id)
  if (!d) throw new Error(`Unknown destination: ${id}`)
  return d
}
