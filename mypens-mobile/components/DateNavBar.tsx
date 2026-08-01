import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'

/** Match web food history freedom, with a sane floor so we never scroll forever. */
export const DATE_NAV_LOOKBACK_DAYS = 90

export function isoToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isoYesterday(): string {
  return shiftIso(isoToday(), -1)
}

export function shiftIso(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Today / Yesterday / "Sat 27 Jul" — use in body copy instead of raw ISO. */
export function shortLabel(iso: string): string {
  if (iso === isoToday()) return 'Today'
  if (iso === isoYesterday()) return 'Yesterday'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

type Props = {
  date: string
  onChange: (next: string) => void
  /**
   * Kept for call-site compat only — ignored.
   * History chips were removed (P0 double date chrome). Do not re-render a chip strip here or in consumers.
   */
  recentDates?: string[]
  accent?: string
  /** How far back ← may go (default 90). */
  lookbackDays?: number
}

/**
 * Single date chrome: ← / Yesterday / Today / → + shortLabel.
 * This IS the history UI (arrows + lookbackDays) — do not add a second chip strip in consumers.
 */
export function DateNavBar({
  date,
  onChange,
  recentDates: _recentDates,
  accent,
  lookbackDays = DATE_NAV_LOOKBACK_DAYS,
}: Props) {
  void _recentDates
  const colors = useColors()
  const primary = accent ?? colors.primary
  const today = isoToday()
  const yesterday = isoYesterday()
  const earliest = shiftIso(today, -Math.max(1, lookbackDays))
  const isToday = date === today
  const isYesterday = date === yesterday
  const atFloor = date <= earliest

  const go = (next: string) => {
    if (next > today) onChange(today)
    else if (next < earliest) onChange(earliest)
    else onChange(next)
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={() => go(shiftIso(date, -1))}
          disabled={atFloor}
          accessibilityLabel="Previous day"
          style={[
            styles.iconBtn,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
              opacity: atFloor ? 0.35 : 1,
            },
          ]}
          hitSlop={8}
        >
          <Feather name="chevron-left" size={18} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={() => go(yesterday)}
          style={[
            styles.pill,
            {
              backgroundColor: isYesterday ? primary : colors.secondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={{
              color: isYesterday ? '#fff' : colors.foreground,
              fontSize: 12,
              fontFamily: 'Inter_600SemiBold',
            }}
          >
            Yesterday
          </Text>
        </Pressable>
        <Pressable
          onPress={() => go(today)}
          style={[
            styles.pill,
            {
              backgroundColor: isToday ? primary : colors.secondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={{
              color: isToday ? '#fff' : colors.foreground,
              fontSize: 12,
              fontFamily: 'Inter_600SemiBold',
            }}
          >
            Today
          </Text>
        </Pressable>
        <Pressable
          onPress={() => go(shiftIso(date, 1))}
          disabled={isToday}
          accessibilityLabel="Next day"
          style={[
            styles.iconBtn,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
              opacity: isToday ? 0.35 : 1,
            },
          ]}
          hitSlop={8}
        >
          <Feather name="chevron-right" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.iso, { color: colors.mutedForeground }]}>
          {shortLabel(date)}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  iconBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  iso: { fontSize: 11, fontFamily: 'Inter_500Medium', marginLeft: 4 },
})
