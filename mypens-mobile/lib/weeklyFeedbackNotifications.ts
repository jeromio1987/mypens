// Weekly Feedback local notifications (Android + iOS).
//
// Schedules a single repeating LOCAL notification every Sunday at 18:00
// nudging the user to read the week's feedback. There is no server push
// in v1 — the report itself is generated out-of-band by the local script
// and the client just fetches it when the user opens the screen. Tapping
// the notification deep-links to `/weekly-feedback` (wired in _layout.tsx).
//
// Expo Go (SDK 53+) removed remote push on Android and importing
// expo-notifications can throw. We skip the whole module in Expo Go so
// Food / logging still works; use a dev build later for real notifications.

import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

const ENABLED_KEY = 'weeklyFeedback.notifications.enabled'
const IDS_KEY = 'weeklyFeedback.notifications.ids'
const ANDROID_CHANNEL = 'weekly-feedback'

/** Route a notification tap should open. */
export const WEEKLY_FEEDBACK_HREF = '/weekly-feedback'

/** Expo Go cannot use expo-notifications push APIs on Android SDK 53+. */
export function notificationsSupportedInThisClient(): boolean {
  if (Platform.OS === 'web') return false
  // appOwnership === 'expo' → Expo Go; null/standalone → dev client or store build
  if (Constants.appOwnership === 'expo') return false
  return true
}

async function loadNotifications() {
  if (!notificationsSupportedInThisClient()) return null
  try {
    return await import('expo-notifications')
  } catch {
    return null
  }
}

export async function getWeeklyFeedbackNotifEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(ENABLED_KEY)
    // Default ON so a fresh install gets the Sunday nudge.
    return v == null ? true : v === '1'
  } catch {
    return true
  }
}

export async function setWeeklyFeedbackNotifEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
  if (!notificationsSupportedInThisClient()) return
  if (enabled) {
    await scheduleWeeklyFeedbackNotification()
  } else {
    await cancelWeeklyFeedbackNotification()
  }
}

async function cancelWeeklyFeedbackNotification(): Promise<void> {
  if (!notificationsSupportedInThisClient()) return
  const Notifications = await loadNotifications()
  if (!Notifications) return
  try {
    const raw = await AsyncStorage.getItem(IDS_KEY)
    const ids: string[] = raw ? JSON.parse(raw) : []
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    }
    await AsyncStorage.removeItem(IDS_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * (Re)schedule the Sunday 18:00 weekly reminder. Idempotent: cancels any
 * previously scheduled copy first so we never stack duplicates.
 */
export async function scheduleWeeklyFeedbackNotification(): Promise<void> {
  if (!notificationsSupportedInThisClient()) return
  const Notifications = await loadNotifications()
  if (!Notifications) return

  try {
    const perms = await Notifications.getPermissionsAsync()
    let granted = perms.granted
    if (!granted && perms.canAskAgain !== false) {
      const req = await Notifications.requestPermissionsAsync()
      granted = req.granted
    }
    if (!granted) return

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Weekly Feedback',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }

    await cancelWeeklyFeedbackNotification()

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your weekly feedback is ready',
        body: 'See how your week went — health and how you worked with Claude.',
        data: { href: WEEKLY_FEEDBACK_HREF },
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // 1 = Sunday
        hour: 18,
        minute: 0,
      },
    })

    await AsyncStorage.setItem(IDS_KEY, JSON.stringify([id]))
  } catch {
    /* non-fatal — notifications are a nudge, not a requirement */
  }
}

/**
 * Called once on app launch. Configures how notifications are presented
 * while the app is foregrounded and (re)schedules the weekly reminder if
 * the user hasn't turned it off.
 */
export async function initWeeklyFeedbackNotificationsOnLaunch(): Promise<void> {
  if (!notificationsSupportedInThisClient()) return
  const Notifications = await loadNotifications()
  if (!Notifications) return

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    })
  } catch {
    /* older SDKs use a different shape — safe to ignore */
  }

  if (await getWeeklyFeedbackNotifEnabled()) {
    await scheduleWeeklyFeedbackNotification()
  }
}
