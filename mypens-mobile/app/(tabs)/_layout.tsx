import { BlurView } from 'expo-blur'
import { Tabs } from 'expo-router'
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import React from 'react'
import { Platform, StyleSheet, View, useColorScheme } from 'react-native'

import { DESTINATIONS } from '@/lib/destinations'
import { continental as C } from '@/constants/continental'

/** WP 1.2 / 3.3 — Fueling · Train · Read · Audit. Continental tab chrome. */
export default function TabLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const isIOS = Platform.OS === 'ios'
  const isWeb = Platform.OS === 'web'

  const iconFor = (id: string, color: string, size: number) => {
    switch (id) {
      case 'read':
        return <Feather name="book-open" size={size} color={color} />
      case 'fueling':
        return <Ionicons name="restaurant-outline" size={size} color={color} />
      case 'train':
        return <MaterialCommunityIcons name="weight-lifter" size={size} color={color} />
      case 'audit':
        return <Feather name="clipboard" size={size} color={color} />
      default:
        return <Feather name="circle" size={size} color={color} />
    }
  }

  return (
    <Tabs
      initialRouteName="read"
      screenOptions={{
        tabBarActiveTintColor: C.cream,
        tabBarInactiveTintColor: C.creamDim,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : C.surfaceHigh,
          borderTopWidth: 0,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'Inter_500Medium',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: isIOS ? 0 : 4,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.surfaceHigh }]} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.surfaceHigh }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="read"
        options={{
          title: DESTINATIONS.find(d => d.id === 'read')!.label,
          tabBarIcon: ({ color, size }) => iconFor('read', color, size),
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: DESTINATIONS.find(d => d.id === 'fueling')!.label,
          tabBarIcon: ({ color, size }) => iconFor('fueling', color, size),
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: DESTINATIONS.find(d => d.id === 'train')!.label,
          tabBarIcon: ({ color, size }) => iconFor('train', color, size),
        }}
      />
      <Tabs.Screen
        name="audit"
        options={{
          title: DESTINATIONS.find(d => d.id === 'audit')!.label,
          tabBarIcon: ({ color, size }) => iconFor('audit', color, size),
        }}
      />
      {/* Capture / legacy — not on tab bar */}
      <Tabs.Screen name="index" options={{ href: null, title: 'Weight' }} />
      <Tabs.Screen name="weight" options={{ href: null }} />
      <Tabs.Screen name="sleep" options={{ href: null, title: 'Sleep' }} />
      <Tabs.Screen name="measurements" options={{ href: null, title: 'Body' }} />
      <Tabs.Screen name="journal" options={{ href: null, title: 'Journal' }} />
    </Tabs>
  )
}
