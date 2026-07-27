import React from 'react'
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

type Props = {
  date: string
  onChange: (next: string) => void
  /** Kept for call-site compat; chips removed so Fueling only shows one date row. */
  recentDates?: string[]
  accent?: string
}

/** Single row: ← / Yesterday / Today / → + ISO — no second chip bar. */
export function DateNavBar({ date, onChange, accent }: Props) {
  const colors = useColors()
  const primary = accent ?? colors.primary
  const today = isoToday()
  const yesterday = isoYesterday()
  const isToday = date === today
  const isYesterday = date === yesterday

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
          onPress={() => onChange(yesterday)}
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
          onPress={() => onChange(today)}
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
