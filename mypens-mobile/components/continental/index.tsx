import React, { type ReactNode } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Feather } from '@expo/vector-icons'

import { continental as C } from '@/constants/continental'

type ScreenProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  children: ReactNode
  refreshing?: boolean
  onRefresh?: () => void
  footer?: ReactNode
}

export function ContinentalScreen({
  eyebrow,
  title,
  subtitle,
  children,
  refreshing,
  onRefresh,
  footer,
}: ScreenProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const topPad = Platform.OS === 'web' ? 16 : insets.top + 8

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Feather name="chevron-left" size={22} color={C.cream} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={C.cream}
            />
          ) : undefined
        }
      >
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.body}>{children}</View>
        {footer}
      </ScrollView>
    </View>
  )
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>
}

export function Block({
  children,
  style,
  elevated,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  elevated?: boolean
}) {
  return (
    <View
      style={[
        styles.block,
        { backgroundColor: elevated ? C.surfaceHighest : C.surfaceHigh },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function MetricChip({
  label,
  value,
  critical,
}: {
  label: string
  value: string
  critical?: boolean
}) {
  return (
    <View style={[styles.chip, critical && styles.chipCritical]}>
      <Text style={[styles.chipLabel, critical && { color: C.oxblood }]}>{label}</Text>
      <Text style={[styles.chipValue, critical && { color: C.oxblood }]}>{value}</Text>
    </View>
  )
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryBtn, disabled && { opacity: 0.4 }]}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  )
}

export function OxbloodButton({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.oxbloodBtn, disabled && { opacity: 0.4 }]}
    >
      <Text style={styles.oxbloodBtnText}>{label}</Text>
    </Pressable>
  )
}

export function EmptyHint({ children }: { children: string }) {
  return <Text style={styles.empty}>{children}</Text>
}

export function LoadingBlock() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={C.cream} />
    </View>
  )
}

export function ApiGate({ configured, children }: { configured: boolean; children: ReactNode }) {
  if (!configured) {
    return (
      <Block>
        <EmptyHint>
          pens API not configured. Set EXPO_PUBLIC_PENS_API_URL and EXPO_PUBLIC_PENS_API_TOKEN, then
          restart Expo.
        </EmptyHint>
      </Block>
    )
  }
  return <>{children}</>
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  backLabel: {
    color: C.creamMuted,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  scroll: {
    paddingHorizontal: 16,
  },
  eyebrow: {
    color: C.oxblood,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 8,
  },
  title: {
    color: C.cream,
    fontFamily: C.fonts.display,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    color: C.creamMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  body: {
    gap: 16,
  },
  sectionLabel: {
    color: C.creamDim,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 8,
  },
  block: {
    borderRadius: C.radius,
    padding: 16,
    gap: 10,
  },
  chip: {
    backgroundColor: C.secondaryContainer,
    borderRadius: C.radius,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: '47%',
    flexGrow: 1,
  },
  chipCritical: {
    backgroundColor: C.oxbloodDeep,
  },
  chipLabel: {
    color: C.creamDim,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  chipValue: {
    color: C.cream,
    fontSize: 18,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: C.cream,
    borderRadius: C.radius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: C.onPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  oxbloodBtn: {
    backgroundColor: C.oxbloodDeep,
    borderRadius: C.radius,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: C.oxblood,
  },
  oxbloodBtnText: {
    color: C.oxblood,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  empty: {
    color: C.creamMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  loading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
})
