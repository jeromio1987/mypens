import { BlurView } from 'expo-blur'
import { isLiquidGlassAvailable } from 'expo-glass-effect'
import { Tabs } from 'expo-router'
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs'
import { SymbolView } from 'expo-symbols'
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import React from 'react'
import { Platform, StyleSheet, View, useColorScheme } from 'react-native'

import { useColors } from '@/hooks/useColors'

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'scalemass', selected: 'scalemass.fill' }} />
        <Label>Weight</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="food">
        <Icon sf={{ default: 'fork.knife', selected: 'fork.knife' }} />
        <Label>Food</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sleep">
        <Icon sf={{ default: 'moon', selected: 'moon.fill' }} />
        <Label>Sleep</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="training">
        <Icon sf={{ default: 'figure.run', selected: 'figure.run' }} />
        <Label>Training</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="measurements">
        <Icon sf={{ default: 'ruler', selected: 'ruler.fill' }} />
        <Label>Body</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal">
        <Icon sf={{ default: 'book', selected: 'book.fill' }} />
        <Label>Journal</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}

function ClassicTabLayout() {
  const colors = useColors()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const isIOS = Platform.OS === 'ios'
  const isWeb = Platform.OS === 'web'

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'Inter_500Medium',
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
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Weight',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="scalemass" tintColor={color} size={size} />
            ) : (
              <MaterialCommunityIcons name="scale-bathroom" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: 'Food',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="fork.knife" tintColor={color} size={size} />
            ) : (
              <Ionicons name="restaurant-outline" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="sleep"
        options={{
          title: 'Sleep',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="moon.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="moon" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Training',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="figure.run" tintColor={color} size={size} />
            ) : (
              <MaterialCommunityIcons name="weight-lifter" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="measurements"
        options={{
          title: 'Body',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="ruler" tintColor={color} size={size} />
            ) : (
              <MaterialCommunityIcons name="tape-measure" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="book.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="book-open" size={size} color={color} />
            ),
        }}
      />
    </Tabs>
  )
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />
  }
  return <ClassicTabLayout />
}
