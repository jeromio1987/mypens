import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '@/constants/theme'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.cardBg },
        headerTitleStyle: { color: theme.text, fontWeight: '600', fontSize: 17 },
        headerShadowVisible: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.cardBg,
          borderTopColor: theme.shadow,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="weight"
        options={{
          title: 'Weight',
          tabBarIcon: ({ color, size }) => <Ionicons name="scale-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: 'Food',
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sleep"
        options={{
          title: 'Sleep',
          tabBarIcon: ({ color, size }) => <Ionicons name="moon-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Train',
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="measurements"
        options={{
          title: 'Body',
          tabBarIcon: ({ color, size }) => <Ionicons name="resize-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
