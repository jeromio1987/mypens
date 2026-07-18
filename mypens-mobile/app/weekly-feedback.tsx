import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import { MODULE_COLORS } from '@/constants/colors'
import { pensFetch, isPensApiConfigured } from '@/lib/pensApi'
import {
  getWeeklyFeedbackNotifEnabled,
  setWeeklyFeedbackNotifEnabled,
} from '@/lib/weeklyFeedbackNotifications'

const MOD = MODULE_COLORS.feedback

interface WorkMetrics {
  available?: boolean
  sessions?: number
  promptCount?: number
  avgPromptChars?: number
  contextInclusionRate?: number
  toolUseCount?: number
  subagentCount?: number
  lateNightPromptCount?: number
  shortPromptCount?: number
}

interface HealthMetrics {
  sleep?: { avgHours: number; avgQuality: number; nightsUnder6h5: number } | null
  weight?: { lastKg: number; trend: string; deltaKg: number } | null
  training?: { sessions: number; totalVolumeKg: number } | null
  food?: { avgKcalPerDay: number; avgProteinPerDay: number } | null
  mood?: { avgMood: number } | null
  anchor?: { cleanStreakDays: number; alcoholDaysThisWeek: number } | null
}

interface Report {
  weekOf: string
  weekEnd: string
  combinedSummary: string
  healthAnalysis: string
  claudeWorkAnalysis: string
  wins: string[]
  improvements: string[]
  healthActions: string[]
  metrics: { work?: WorkMetrics; health?: HealthMetrics; crossLinks?: string[] }
  model: string | null
  generatedAt: string
}

function fmtRange(weekOf?: string, weekEnd?: string): string {
  if (!weekOf || !weekEnd) return ''
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const a = new Date(weekOf + 'T00:00:00').toLocaleDateString('en-GB', opts)
  const b = new Date(weekEnd + 'T00:00:00').toLocaleDateString('en-GB', opts)
  return `${a} – ${b}`
}

async function fetchReport(): Promise<Report | null> {
  const res = await pensFetch('/api/weekly-feedback')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return (json.report ?? null) as Report | null
}

export default function WeeklyFeedbackScreen() {
  const colors = useColors()
  const isDark = useColorScheme() === 'dark'
  const insets = useSafeAreaInsets()
  const configured = isPensApiConfigured()
  const accentBg = isDark ? MOD.bgDark : MOD.bg

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['weekly-feedback'],
    queryFn: fetchReport,
    enabled: configured,
  })

  const [notifEnabled, setNotifEnabled] = useState(true)
  useEffect(() => {
    getWeeklyFeedbackNotifEnabled().then(setNotifEnabled)
  }, [])
  const onToggleNotif = async (v: boolean) => {
    setNotifEnabled(v)
    await setWeeklyFeedbackNotifEnabled(v)
  }

  const report = data ?? null
  const work = report?.metrics?.work
  const health = report?.metrics?.health
  const crossLinks = report?.metrics?.crossLinks ?? []

  const topPad = Platform.OS === 'web' ? 16 : insets.top + 8

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: insets.bottom + 40 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={MOD.primary} />
      }
    >
      <View style={styles.header}>
        <View style={[styles.moduleTag, { backgroundColor: accentBg }]}>
          <Feather name="activity" size={16} color={MOD.primary} />
          <Text style={[styles.moduleLabel, { color: MOD.primary }]}>Weekly Feedback</Text>
        </View>
        {report && (
          <Text style={[styles.range, { color: colors.mutedForeground }]}>
            {fmtRange(report.weekOf, report.weekEnd)}
          </Text>
        )}
      </View>

      {!configured && (
        <Card colors={colors}>
          <Text style={[styles.body, { color: colors.foreground }]}>
            Connect the app to your MY PENS server to see weekly feedback. Set
            EXPO_PUBLIC_PENS_API_URL and EXPO_PUBLIC_PENS_API_TOKEN.
          </Text>
        </Card>
      )}

      {configured && isLoading && (
        <View style={{ paddingTop: 48 }}>
          <ActivityIndicator color={MOD.primary} />
        </View>
      )}

      {configured && !isLoading && error && (
        <Card colors={colors}>
          <Text style={[styles.body, { color: colors.foreground }]}>
            Couldn&apos;t load this week&apos;s feedback. Pull to retry.
          </Text>
        </Card>
      )}

      {configured && !isLoading && !error && !report && (
        <Card colors={colors}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>No feedback yet</Text>
          <Text style={[styles.body, { color: colors.mutedForeground, marginTop: 6 }]}>
            Run the weekly generator on your computer:
          </Text>
          <Text style={[styles.code, { color: MOD.primary, backgroundColor: accentBg }]}>
            npm run feedback:weekly
          </Text>
        </Card>
      )}

      {configured && !isLoading && !error && report && (
        <>
          {/* Summary */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.eyebrow, { color: MOD.primary }]}>THE WEEK IN ONE READ</Text>
            <Text style={[styles.summary, { color: colors.foreground }]}>{report.combinedSummary}</Text>
            {crossLinks.map((l, i) => (
              <View key={i} style={styles.crossRow}>
                <Feather name="link" size={12} color={MOD.primary} style={{ marginTop: 3 }} />
                <Text style={[styles.crossText, { color: colors.mutedForeground }]}>{l}</Text>
              </View>
            ))}
          </View>

          <ListCard title="Wins" color="#22c55e" items={report.wins} colors={colors} />
          <ListCard
            title="Improvements · prompting & projects"
            color={MOD.primary}
            items={report.improvements}
            colors={colors}
          />
          <ListCard
            title="Health actions for next week"
            color="#f59e0b"
            items={report.healthActions}
            colors={colors}
          />

          {/* Health */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.eyebrow, { color: '#22c55e' }]}>HEALTH &amp; LIFE</Text>
            <Text style={[styles.body, { color: colors.foreground }]}>{report.healthAnalysis}</Text>
            <View style={styles.statGrid}>
              {health?.sleep && (
                <Stat colors={colors} label="Sleep" value={`${health.sleep.avgHours}h`} hint={`q${health.sleep.avgQuality}`} />
              )}
              {health?.weight && (
                <Stat colors={colors} label="Weight" value={`${health.weight.lastKg}kg`} hint={health.weight.trend} />
              )}
              {health?.training && (
                <Stat colors={colors} label="Training" value={`${health.training.sessions}×`} hint={`${health.training.totalVolumeKg}kg`} />
              )}
              {health?.food && (
                <Stat colors={colors} label="Food" value={`${health.food.avgKcalPerDay}`} hint={`${health.food.avgProteinPerDay}g P`} />
              )}
              {health?.mood && <Stat colors={colors} label="Mood" value={`${health.mood.avgMood}/5`} />}
              {health?.anchor && (
                <Stat colors={colors} label="Anchor" value={`${health.anchor.cleanStreakDays}d`} hint={`${health.anchor.alcoholDaysThisWeek} drink d`} />
              )}
            </View>
          </View>

          {/* Claude work */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.eyebrow, { color: MOD.primary }]}>WORKING WITH CLAUDE</Text>
            <Text style={[styles.body, { color: colors.foreground }]}>{report.claudeWorkAnalysis}</Text>
            {work?.available ? (
              <View style={styles.statGrid}>
                <Stat colors={colors} label="Prompts" value={`${work.promptCount ?? 0}`} hint={`${work.sessions ?? 0} sessions`} />
                <Stat colors={colors} label="Avg len" value={`${work.avgPromptChars ?? 0}`} hint="chars" />
                <Stat colors={colors} label="Context" value={`${Math.round((work.contextInclusionRate ?? 0) * 100)}%`} />
                <Stat colors={colors} label="Tools" value={`${work.toolUseCount ?? 0}`} hint={`${work.subagentCount ?? 0} subagents`} />
                <Stat colors={colors} label="Late-night" value={`${work.lateNightPromptCount ?? 0}`} hint="after 22:00" />
                <Stat colors={colors} label="Short" value={`${work.shortPromptCount ?? 0}`} hint="<60 chars" />
              </View>
            ) : (
              <Text style={[styles.body, { color: colors.mutedForeground, marginTop: 8 }]}>
                No transcript data for this week.
              </Text>
            )}
          </View>

          <Text style={[styles.footer, { color: colors.mutedForeground }]}>
            Generated {new Date(report.generatedAt).toLocaleDateString('en-GB')}
            {report.model ? ` · ${report.model}` : ' · deterministic'}
          </Text>
        </>
      )}

      {/* Sunday reminder toggle — available regardless of report state */}
      {Platform.OS !== 'web' && (
        <View
          style={[
            styles.card,
            styles.settingRow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontSize: 14 }]}>Sunday reminder</Text>
            <Text style={[styles.body, { color: colors.mutedForeground, fontSize: 12, marginTop: 2 }]}>
              A weekly nudge at 18:00 to review this report.
            </Text>
          </View>
          <Switch
            value={notifEnabled}
            onValueChange={onToggleNotif}
            trackColor={{ true: MOD.primary, false: colors.border }}
          />
        </View>
      )}
    </ScrollView>
  )
}

type Colors = ReturnType<typeof useColors>

function Card({ children, colors }: { children: React.ReactNode; colors: Colors }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>
  )
}

function ListCard({
  title,
  color,
  items,
  colors,
}: {
  title: string
  color: string
  items: string[]
  colors: Colors
}) {
  if (!items || items.length === 0) return null
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.eyebrow, { color }]}>{title.toUpperCase()}</Text>
      {items.map((it, i) => (
        <View key={i} style={styles.listRow}>
          <Text style={[styles.listNum, { color }]}>{i + 1}.</Text>
          <Text style={[styles.body, { color: colors.foreground, flex: 1 }]}>{it}</Text>
        </View>
      ))}
    </View>
  )
}

function Stat({
  label,
  value,
  hint,
  colors,
}: {
  label: string
  value: string
  hint?: string
  colors: Colors
}) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      {hint ? <Text style={[styles.statHint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, marginBottom: 12, gap: 6 },
  moduleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  moduleLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  range: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  summary: { fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  crossRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  crossText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, flex: 1 },
  listRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  listNum: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  stat: {
    width: '47%',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  statLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.5 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 2 },
  statHint: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 1 },
  footer: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', marginTop: 4 },
})
