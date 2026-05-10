import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import { LineChart } from 'react-native-gifted-charts'
import { theme } from '@/constants/theme'

/** Placeholder trend — wired to gifted-charts shape; loads real WeightEntry rows in build order §3 */
export default function WeightScreen() {
  const { width } = useWindowDimensions()
  const chartWidth = Math.max(280, width - 72)
  const synthetic = [
    { value: 89.7 },
    { value: 89.9 },
    { value: 89.4 },
    { value: 89.8 },
    { value: 89.6 },
    { value: 89.3 },
    { value: 89.1 },
  ]
  const accent = theme.weightAccent

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={[styles.badge, { color: accent }]}>Weight · v3 model</Text>
        <Text style={styles.headline}>Entry form + enriched trend charts</Text>
        <Text style={styles.muted}>
          Use{' '}
          <Text style={{ fontFamily: undefined, fontWeight: '600', color: theme.text }}>lib/retentionModels.ts</Text>{' '}
          client-side after Supabase selects (same as web GET handler).
        </Text>
      </View>
      <View style={[styles.card, styles.chartWrap]}>
        <Text style={styles.chartTitle}>30-day preview (stub data)</Text>
        <LineChart
          width={chartWidth}
          curved
          data={synthetic}
          height={200}
          color={accent}
          startFillColor={accent}
          endFillColor={theme.background}
          startOpacity={0.25}
          endOpacity={0.02}
          areaChart
          hideDataPoints
          thickness={2}
          yAxisThickness={0}
          xAxisThickness={0}
          yAxisLabelWidth={40}
          yAxisColor={theme.textMuted}
          xAxisColor={theme.textMuted}
          rulesColor="transparent"
          yAxisTextStyle={{ color: theme.textMuted, fontSize: 10 }}
          xAxisIndicesHeight={40}
          noOfSections={4}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background, padding: 16, gap: 16 },
  card: {
    backgroundColor: theme.cardBg,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  badge: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 },
  headline: { fontSize: 18, fontWeight: '700', color: theme.text },
  muted: { marginTop: 8, fontSize: 14, color: theme.textMuted, lineHeight: 20 },
  chartWrap: { paddingBottom: 8 },
  chartTitle: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 12 },
})
