import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import {
  fitnessFlags,
  formatLoadNum,
  type FitnessFreshnessSnapshot,
} from '@/lib/cockpitWindow'

const ACCENT = '#fb923c' // training orange

type Props = {
  fitness: FitnessFreshnessSnapshot | null
  /** Compact = single row for cards; full = labeled grid. */
  compact?: boolean
}

const INFO_COPY =
  'Fitness is your longer-term training load; Fatigue is what you have done recently. Ready is Fitness minus Fatigue — negative means recent work has left you more tired. This is a descriptive load model from training data, not medical readiness, and it is not the cockpit Form score.'

const BALANCE_INFO =
  ' Load balance compares recent load to the last few weeks — a high value means a sharp jump.'

/**
 * Banister Fitness / Freshness from period-review payload.
 * Distinct from cockpit "Form" (formScore) — this is CTL / ATL / TSB (jargon kept off the UI).
 */
export function FitnessFreshnessStrip({ fitness, compact = false }: Props) {
  const colors = useColors()
  const [showInfo, setShowInfo] = useState(false)
  if (!fitness) return null

  const flags = fitnessFlags(fitness)
  const showBalance = fitness.acwr != null

  const cells: { label: string; hint: string; value: string; warn?: boolean }[] = [
    {
      label: 'Fitness',
      hint: 'longer-term training load',
      value: formatLoadNum(fitness.ctl),
    },
    {
      label: 'Fatigue',
      hint: 'recent load',
      value: formatLoadNum(fitness.atl),
    },
    {
      label: 'Ready',
      hint: 'fitness minus fatigue',
      value: formatLoadNum(fitness.tsb),
      warn: flags.fatigued,
    },
  ]

  if (showBalance) {
    cells.push({
      label: 'Load balance',
      hint: 'recent vs longer-term',
      value: formatLoadNum(fitness.acwr, 2),
      warn: flags.elevatedAcwr,
    })
  }

  const infoText = showBalance ? INFO_COPY + BALANCE_INFO : INFO_COPY

  const infoToggle = (
    <Pressable
      onPress={() => setShowInfo(s => !s)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={showInfo ? 'Hide load model explanation' : 'What is this load model?'}
    >
      <Feather name="info" size={14} color={colors.mutedForeground} />
    </Pressable>
  )

  if (compact) {
    return (
      <View style={[styles.compactRow, { backgroundColor: colors.secondary }]}>
        <View style={styles.compactHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.compactEyebrow, { color: ACCENT }]}>Training load</Text>
            <Text style={[styles.compactSub, { color: colors.mutedForeground }]}>
              Not Form score · descriptive only
            </Text>
          </View>
          {infoToggle}
        </View>
        <Text style={[styles.compactLine, { color: colors.foreground }]} numberOfLines={1}>
          Fitness {formatLoadNum(fitness.ctl)} · Fatigue {formatLoadNum(fitness.atl)} · Ready{' '}
          <Text style={{ color: flags.fatigued ? '#fbbf24' : '#34d399' }}>
            {formatLoadNum(fitness.tsb)}
          </Text>
          {showBalance ? ` · Balance ${formatLoadNum(fitness.acwr, 2)}` : ''}
        </Text>
        {showInfo ? (
          <Text style={[styles.explain, { color: colors.mutedForeground }]}>{infoText}</Text>
        ) : null}
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: ACCENT }]}>Fitness & freshness</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            From training load — not the cockpit Form score
          </Text>
        </View>
        {infoToggle}
      </View>
      {showInfo ? (
        <Text style={[styles.explain, { color: colors.mutedForeground }]}>{infoText}</Text>
      ) : null}
      <View style={styles.grid}>
        {cells.map(c => (
          <View
            key={c.label}
            style={[styles.cell, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          >
            <Text style={[styles.label, { color: c.warn ? '#fbbf24' : colors.mutedForeground }]}>
              {c.label}
            </Text>
            <Text style={[styles.value, { color: c.warn ? '#fbbf24' : colors.foreground }]}>
              {c.value}
            </Text>
            <Text style={[styles.cellHint, { color: colors.mutedForeground }]} numberOfLines={2}>
              {c.hint}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, marginBottom: 4 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  eyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  explain: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 68,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  label: { fontSize: 9, fontFamily: 'Inter_500Medium', textTransform: 'uppercase' },
  value: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  cellHint: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 3, lineHeight: 12 },
  compactRow: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 2,
  },
  compactEyebrow: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  compactSub: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 1 },
  compactLine: { fontFamily: 'Inter_500Medium', fontSize: 13 },
})
