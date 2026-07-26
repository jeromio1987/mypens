import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'

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

function shortLabel(iso: string): string {
  if (iso === isoToday()) return 'Today'
  if (iso === isoYesterday()) return 'Yesterday'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
}

type Props = {
  date: string
  onChange: (next: string) => void
  /** Extra ISO dates to show as chips (e.g. recently logged). */
  recentDates?: string[]
  accent?: string
}

/** Compact ← / Yesterday / chips / → for late entry without typing yyyy-mm-dd. */
export function DateNavBar({ date, onChange, recentDates = [], accent }: Props) {
  const colors = useColors()
  const primary = accent ?? colors.primary
  const today = isoToday()
  const isToday = date === today

  const chips = useMemo(() => {
    const set = new Set<string>([...recentDates, date, today, isoYesterday()])
    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 10)
  }, [recentDates, date, today])

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(shiftIso(date, -1))}
          style={[styles.iconBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          hitSlop={8}
        >
          <Feather name="chevron-left" size={18} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={() => onChange(isoYesterday())}
          style={[
            styles.pill,
            {
              backgroundColor: date === isoYesterday() ? primary : colors.secondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={{
              color: date === isoYesterday() ? '#fff' : colors.foreground,
              fontSize: 12,
              fontFamily: 'Inter_600SemiBold',
            }}
          >
            Yesterday
          </Text>
        </Pressable>
        {!isToday ? (
          <Pressable
            onPress={() => onChange(today)}
            style={[styles.pill, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
              Today
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => onChange(shiftIso(date, 1))}
          disabled={isToday}
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
        <Text style={[styles.iso, { color: colors.mutedForeground }]}>{date}</Text>
      </View>
      <View style={styles.chips}>
        {chips.map(d => {
          const on = d === date
          return (
            <Pressable
              key={d}
              onPress={() => onChange(d)}
              style={[
                styles.chip,
                {
                  backgroundColor: on ? primary : colors.secondary,
                  borderColor: on ? primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: on ? '#fff' : colors.foreground,
                  fontSize: 11,
                  fontFamily: 'Inter_500Medium',
                }}
              >
                {shortLabel(d)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 10 },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
})
