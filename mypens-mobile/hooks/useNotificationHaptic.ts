import * as Haptics from 'expo-haptics'

/** Light haptic ping for confirmations (import success, save, etc.). */
export function notificationHaptic(type: 'success' | 'warning' | 'error' = 'success') {
  const match = {
    success: Haptics.NotificationFeedbackType.Success,
    warning: Haptics.NotificationFeedbackType.Warning,
    error: Haptics.NotificationFeedbackType.Error,
  }
  void Haptics.notificationAsync(match[type])
}
