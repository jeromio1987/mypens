import { View, Text, StyleSheet } from 'react-native'
import { theme } from '@/constants/theme'

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.h2}>MY PENS</Text>
        <Text style={styles.muted}>Dashboard — numeric summary cards ship in v1 (see MOBILE_SPEC).</Text>
      </View>
      <View style={styles.grid}>
        {['Weight', 'Food', 'Sleep', 'Training', 'Measurements'].map(label => (
          <View key={label} style={styles.tile}>
            <Text style={styles.tileLabel}>{label}</Text>
            <Text style={styles.tileMuted}>—</Text>
          </View>
        ))}
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
  h2: { fontSize: 22, fontWeight: '700', color: theme.text, marginBottom: 8 },
  muted: { color: theme.textMuted, fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: theme.cardBg,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tileLabel: { fontSize: 13, fontWeight: '600', color: theme.text },
  tileMuted: { marginTop: 8, color: theme.textMuted, fontSize: 18 },
})
