import { View, Text, StyleSheet } from 'react-native'
import { theme } from '@/constants/theme'

export default function SleepScreen() {
  return (
    <View style={styles.container}>
      <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: theme.sleepAccent }]}>
        <Text style={styles.title}>Sleep</Text>
        <Text style={styles.muted}>Bed/wake wheels, duration, quality 1–5, optional HRV + trend chart.</Text>
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
