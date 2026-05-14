import * as Haptics from 'expo-haptics'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Feather } from '@expo/vector-icons'

import { useColors } from '@/hooks/useColors'
import { MODULE_COLORS } from '@/constants/colors'
import { supabase } from '@/lib/supabase'
import { generateId } from '@/lib/generateId'

const MOD = MODULE_COLORS.journal
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface JournalEntry {
  id: string
  createdAt: string
  date: string
  title?: string
  content: string
  mood?: number
  notes?: string
}

const MOOD_LABELS = ['', 'Rough', 'Low', 'Okay', 'Good', 'Great']
const MOOD_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6']

function MoodPicker({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  const colors = useColors()
  return (
    <View style={moodStyles.row}>
      {[1, 2, 3, 4, 5].map((m) => (
        <Pressable
          key={m}
          onPress={() => onChange(value === m ? 0 : m)}
          style={[
            moodStyles.chip,
            {
              backgroundColor: value === m ? MOOD_COLORS[m] : colors.secondary,
              borderColor: value === m ? MOOD_COLORS[m] : colors.border,
            },
          ]}
        >
          <Text style={{ color: value === m ? '#fff' : colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
            {MOOD_LABELS[m]}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

const moodStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
})

export default function JournalScreen() {
  const colors = useColors()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<number | undefined>(undefined)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: entries = [], isLoading, refetch, isRefetching } = useQuery<JournalEntry[]>({
    queryKey: ['journal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('JournalEntry')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })

  const mutation = useMutation({
    mutationFn: async () => {
      if (!content.trim()) throw new Error('Write something before saving')
      const { error } = await supabase.from('JournalEntry').upsert({
        id: generateId(),
        date: today(),
        title: title.trim() || null,
        content: content.trim(),
        mood: mood && mood > 0 ? mood : null,
      }, { onConflict: 'date' })
      if (error) throw error
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      qc.invalidateQueries({ queryKey: ['journal'] })
      setTitle('')
      setContent('')
      setMood(undefined)
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('JournalEntry').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      qc.invalidateQueries({ queryKey: ['journal'] })
    },
  })

  const accentBg = isDark ? MOD.bgDark : MOD.bg
  const topInset = Platform.OS === 'web' ? 67 : insets.top

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topInset + 16, paddingBottom: insets.bottom + 100 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={MOD.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.moduleTag, { backgroundColor: accentBg }]}>
          <Feather name="book-open" size={16} color={MOD.primary} />
          <Text style={[styles.moduleLabel, { color: MOD.primary }]}>Journal</Text>
        </View>
        <Text style={[styles.entryCount, { color: colors.mutedForeground }]}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </Text>
      </View>

      {/* New entry form */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>New entry</Text>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title (optional)"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.titleInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
        />

        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="What's on your mind today?"
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          style={[styles.contentInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
        />

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>How are you feeling?</Text>
        <MoodPicker value={mood} onChange={setMood} />

        <Pressable
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending}
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: MOD.primary, opacity: pressed || mutation.isPending ? 0.7 : 1 },
          ]}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitText}>Save entry</Text>
          )}
        </Pressable>
      </View>

      {/* Entry list */}
      {isLoading ? (
        <ActivityIndicator color={MOD.primary} style={{ marginTop: 24 }} />
      ) : entries.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="book-open" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No entries yet. Write your first one above.
          </Text>
        </View>
      ) : (
        entries.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => setExpandedId(expandedId === e.id ? null : e.id)}
            style={[styles.entryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.entryHeader}>
              <View style={styles.entryMeta}>
                {e.mood != null && e.mood > 0 && (
                  <View style={[styles.moodDot, { backgroundColor: MOOD_COLORS[e.mood] }]} />
                )}
                <View>
                  <Text style={[styles.entryTitle, { color: colors.foreground }]}>
                    {e.title || new Date(e.createdAt).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={[styles.entryDate, { color: colors.mutedForeground }]}>
                    {new Date(e.createdAt).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
                    {e.mood != null && e.mood > 0 ? ` · ${MOOD_LABELS[e.mood]}` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.entryActions}>
                <Feather
                  name={expandedId === e.id ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.mutedForeground}
                />
                <Pressable
                  onPress={() =>
                    Alert.alert('Delete entry', 'Are you sure?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(e.id) },
                    ])
                  }
                  hitSlop={12}
                  style={{ marginLeft: 12 }}
                >
                  <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            {expandedId === e.id && (
              <Text style={[styles.entryContent, { color: colors.foreground, borderTopColor: colors.border }]}>
                {e.content}
              </Text>
            )}

            {expandedId !== e.id && (
              <Text style={[styles.entryPreview, { color: colors.mutedForeground }]} numberOfLines={2}>
                {e.content}
              </Text>
            )}
          </Pressable>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  moduleTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  moduleLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  entryCount: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  card: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 8, marginTop: 12 },
  titleInput: { borderWidth: 1, borderRadius: 10, height: 44, paddingHorizontal: 12, fontSize: 15, marginBottom: 10, fontFamily: 'Inter_600SemiBold' },
  contentInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, minHeight: 120, marginBottom: 12, fontFamily: 'Inter_400Regular' },
  submitBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10, paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', fontSize: 14, fontFamily: 'Inter_400Regular' },
  entryCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, padding: 16 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  moodDot: { width: 10, height: 10, borderRadius: 5 },
  entryTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  entryDate: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  entryActions: { flexDirection: 'row', alignItems: 'center' },
  entryContent: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  entryPreview: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, marginTop: 8 },
})
