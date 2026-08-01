import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import {
  Block,
  ContinentalScreen,
  EmptyHint,
  MetricChip,
  OxbloodButton,
  PrimaryButton,
  SectionLabel,
} from '@/components/continental'
import { continental as C } from '@/constants/continental'

type Energy = 'low' | 'medium' | 'high'
type TimeSlot = 15 | 45 | 90

const SUGGESTIONS: Record<Energy, Record<TimeSlot, { title: string; body: string; rule: string }>> = {
  low: {
    15: {
      title: 'Cold shower — right now',
      body: '2 minutes, door to door. Fastest reset without chemicals.',
      rule: 'Start before you close this screen.',
    },
    45: {
      title: 'Walk + one full album',
      body: 'Phone in pocket. Walk until the album ends.',
      rule: 'No destination required.',
    },
    90: {
      title: 'Cook something real',
      body: 'A recipe that needs attention — not reheating.',
      rule: 'Pick the recipe now.',
    },
  },
  medium: {
    15: {
      title: '20 push-ups + cold shower',
      body: 'Back to back. The act resets the state.',
      rule: "Don't wait until you feel like it.",
    },
    45: {
      title: 'Training session',
      body: 'Heavy compounds. 30–40 minutes that make you breathe hard.',
      rule: 'Decide now — gym or home.',
    },
    90: {
      title: 'Hard gym or short ride',
      body: 'Use the restlessness before it finds a worse outlet.',
      rule: 'Kit on before you second-guess.',
    },
  },
  high: {
    15: {
      title: 'Sprint intervals — now',
      body: '6 × 30s all-out, 90s recover. Use the energy.',
      rule: 'All-out means all-out.',
    },
    45: {
      title: 'Hard training session',
      body: 'Max effort. No scrolling between sets.',
      rule: 'No phone between sets.',
    },
    90: {
      title: 'The ride you postponed',
      body: 'Open the saved route. Today has the energy for it.',
      rule: 'Pick the route in the next 2 minutes.',
    },
  },
}

export default function DopamineDebtScreen() {
  const [energy, setEnergy] = useState<Energy | null>(null)
  const [slot, setSlot] = useState<TimeSlot | null>(null)
  const [acked, setAcked] = useState(false)

  const suggestion = useMemo(() => {
    if (!energy || !slot) return null
    return SUGGESTIONS[energy][slot]
  }, [energy, slot])

  return (
    <ContinentalScreen
      eyebrow="Neurochemical audit"
      title="Dopamine debt"
      subtitle="No live ledger yet — liquidation protocol only. Craving persistence comes later."
    >
      <SectionLabel>Status</SectionLabel>
      <View style={styles.chipGrid}>
        <MetricChip label="Ledger" value="Shell" />
        <MetricChip label="API" value="None" critical />
        <MetricChip label="Mode" value={acked ? 'Acknowledged' : 'Open'} />
        <MetricChip label="Stage" value={suggestion ? 'Directive' : 'Intake'} />
      </View>

      <SectionLabel>Energy</SectionLabel>
      <View style={styles.row}>
        {(['low', 'medium', 'high'] as Energy[]).map(e => (
          <Pressable
            key={e}
            onPress={() => {
              setEnergy(e)
              setAcked(false)
            }}
            style={[styles.pick, energy === e && styles.pickOn]}
          >
            <Text style={[styles.pickText, energy === e && styles.pickTextOn]}>{e}</Text>
          </Pressable>
        ))}
      </View>

      <SectionLabel>Time available</SectionLabel>
      <View style={styles.row}>
        {([15, 45, 90] as TimeSlot[]).map(t => (
          <Pressable
            key={t}
            onPress={() => {
              setSlot(t)
              setAcked(false)
            }}
            style={[styles.pick, slot === t && styles.pickOn]}
          >
            <Text style={[styles.pickText, slot === t && styles.pickTextOn]}>{t}m</Text>
          </Pressable>
        ))}
      </View>

      {suggestion ? (
        <Block elevated>
          <Text style={styles.sTitle}>{suggestion.title}</Text>
          <Text style={styles.sBody}>{suggestion.body}</Text>
          <Text style={styles.sRule}>Rule: {suggestion.rule}</Text>
        </Block>
      ) : (
        <EmptyHint>Select energy and time to receive a liquidation directive.</EmptyHint>
      )}

      <SectionLabel>Cravings ledger</SectionLabel>
      <Block>
        <EmptyHint>
          No craving events yet — the debt API is not wired. This screen only offers a local
          liquidation directive. Numbers will appear here when CravingEvent lands; nothing is invented.
        </EmptyHint>
      </Block>

      {suggestion ? (
        <OxbloodButton
          label={acked ? 'Confirmed' : 'Initiate liquidation'}
          onPress={() => setAcked(true)}
          disabled={acked}
        />
      ) : (
        <PrimaryButton label="Select energy first" onPress={() => undefined} disabled />
      )}
    </ContinentalScreen>
  )
}

const styles = StyleSheet.create({
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pick: {
    flex: 1,
    backgroundColor: C.surfaceHigh,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickOn: {
    backgroundColor: C.cream,
  },
  pickText: {
    color: C.cream,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
  },
  pickTextOn: {
    color: C.onPrimary,
  },
  sTitle: {
    color: C.cream,
    fontFamily: C.fonts.display,
    fontSize: 20,
  },
  sBody: {
    color: C.cream,
    fontSize: 14,
    lineHeight: 20,
  },
  sRule: {
    color: C.oxblood,
    fontSize: 12,
    marginTop: 4,
  },
})
