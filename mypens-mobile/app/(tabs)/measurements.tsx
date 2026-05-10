import { View, Text, StyleSheet } from 'react-native'
import { theme } from '@/constants/theme'

export default function MeasurementsScreen() {
  return (
    <View style={styles.container}>
      <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: theme.measurementsAccent }]}>
        <Text style={styles.title}>Measurements</Text>
        <Text style={styles.muted}>Body circumferences (`BodyMeasurement` table) quick vs detailed modes.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background, padding: 16 },
  card: {
    backgroundColor: theme.cardBg,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  title: { fontSize: 20, fontWeight: '700', color: theme.text },
  muted: { marginTop: 8, fontSize: 14, color: theme.textMuted, lineHeight: 20 },
})
