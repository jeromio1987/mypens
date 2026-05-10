import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    color: '#111',
    fontFamily: 'Helvetica',
  },
  h1: { fontSize: 18, marginBottom: 8, fontWeight: 'bold' },
  sub: { fontSize: 10, marginBottom: 16, color: '#444' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  muted: { color: '#555', fontSize: 10 },
  section: { marginTop: 12, marginBottom: 6, fontWeight: 'bold', fontSize: 12 },
})

export type WeeklyPdfProps = {
  weekLabel: string
  start: string
  end: string
  summary: {
    avgScaleKg: string
    avgTrueKg: string
    weightTrend: string
    avgKcal: string
    avgProtein: string
    avgSleepH: string
    avgSleepQ: string
    trainSessions: string
    trainVolume: string
  }
  body: {
    bodyFatPct: string
    waistCm: string
  }
  nutritionDetail: {
    carbs: string
    fat: string
  }
  sleepHrv: string
  topExercises: string[]
  moodAvg: string | null
}

export default function WeeklyPdfDocument({
  weekLabel,
  start,
  end,
  summary,
  body,
  nutritionDetail,
  sleepHrv,
  topExercises,
  moodAvg,
}: WeeklyPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>MY PENS — WEEKLY REPORT</Text>
        <Text style={styles.sub}>
          {weekLabel} ({start} – {end})
        </Text>
        <Stat label="Avg scale weight (kg)" value={summary.avgScaleKg} />
        <Stat label="Avg true weight (kg)" value={summary.avgTrueKg} />
        <Stat label="Weight trend (kg)" value={summary.weightTrend} />
        <Stat label="Avg kcal / day" value={summary.avgKcal} />
        <Stat label="Avg protein (g) / day" value={summary.avgProtein} />
        <Stat label="Training sessions" value={summary.trainSessions} />
        <Stat label="Training volume (kg)" value={summary.trainVolume} />
        <Text style={[styles.section, { marginTop: 24 }]}>Weekly snapshot</Text>
        <Text style={styles.muted}>Monochrome audit for the selected 7-day window.</Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Weight and body</Text>
        <Text style={styles.sub}>
          Averages over {start} → {end}
        </Text>
        <Stat label="Avg scale (kg)" value={summary.avgScaleKg} />
        <Stat label="Avg true weight (kg)" value={summary.avgTrueKg} />
        <Stat label="Trend" value={summary.weightTrend} />
        <Text style={[styles.section, { marginTop: 12 }]}>Body composition (if logged)</Text>
        <Stat label="Body fat % (latest)" value={body.bodyFatPct} />
        <Stat label="Waist cm (latest)" value={body.waistCm} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Nutrition</Text>
        <Stat label="Avg kcal / day" value={summary.avgKcal} />
        <Stat label="Avg protein (g) / day" value={summary.avgProtein} />
        <Stat label="Avg carbs (g) / day" value={nutritionDetail.carbs} />
        <Stat label="Avg fat (g) / day" value={nutritionDetail.fat} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Sleep</Text>
        <Stat label="Avg hours / night" value={summary.avgSleepH} />
        <Stat label="Avg quality (1–5)" value={summary.avgSleepQ} />
        <Stat label="HRV (avg ms, when logged)" value={sleepHrv} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Training</Text>
        <Stat label="Sessions" value={summary.trainSessions} />
        <Stat label="Volume (kg)" value={summary.trainVolume} />
        <Text style={styles.section}>Top exercises</Text>
        {topExercises.map((line, i) => (
          <Text key={i} style={{ marginBottom: 3 }}>
            {line}
          </Text>
        ))}
      </Page>

      {moodAvg != null && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>Wellbeing</Text>
          <Stat label="Avg mood (journal, 1–5)" value={moodAvg} />
        </Page>
      )}
    </Document>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text>{value}</Text>
    </View>
  )
}
