import { Link } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { theme } from '@/constants/theme'

export default function NotFoundScreen() {
  return (
      <View style={styles.wrap}>
        <Text style={styles.h1}>Route not found</Text>
        <Link href="/" replace style={styles.link}>
          <Text style={styles.linkText}>Back to MY PENS</Text>
        </Link>
      </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    padding: 24,
    gap: 16,
  },
  h1: { fontSize: 20, fontWeight: '700', color: theme.text },
  link: { padding: 12 },
  linkText: { color: theme.primary, fontWeight: '600', fontSize: 16 },
})
