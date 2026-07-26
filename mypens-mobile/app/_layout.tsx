import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  initWeeklyFeedbackNotificationsOnLaunch,
  notificationsSupportedInThisClient,
} from "@/lib/weeklyFeedbackNotifications";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();

  useEffect(() => {
    // Skip entirely in Expo Go (SDK 53+ Android push removed — import can throw).
    if (!notificationsSupportedInThisClient()) return;

    // Configure presentation + (re)schedule the Sunday reminder.
    void initWeeklyFeedbackNotificationsOnLaunch();

    // Deep-link when the user taps a notification. Dynamically imported so
    // the app never hard-crashes on web / if the native module is absent.
    let subscription: { remove: () => void } | undefined;
    let cancelled = false;

    (async () => {
      try {
        const Notifications = await import("expo-notifications");

        const handleHref = (href?: unknown) => {
          if (typeof href === "string" && href.startsWith("/")) {
            router.push(href as never);
          }
        };

        // Cold start: app opened by tapping a notification.
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) handleHref(last.notification.request.content.data?.href);

        // Warm taps while the app is running.
        if (cancelled) return;
        subscription = Notifications.addNotificationResponseReceivedListener(
          (response) => handleHref(response.notification.request.content.data?.href)
        );
      } catch {
        /* notifications unavailable — ignore */
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [router]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="weekly-feedback"
        options={{ title: "Weekly Feedback", headerShown: true }}
      />
      <Stack.Screen name="audit" options={{ headerShown: false, title: "Audit" }} />
      <Stack.Screen name="verdict" options={{ headerShown: false, title: "Verdict" }} />
      <Stack.Screen
        name="dopamine-debt"
        options={{ headerShown: false, title: "Dopamine debt" }}
      />
      <Stack.Screen name="bloodwork" options={{ headerShown: false, title: "Bloodwork" }} />
      <Stack.Screen name="planner" options={{ headerShown: false, title: "Planner" }} />
      <Stack.Screen
        name="period-review"
        options={{ headerShown: false, title: "Period review" }}
      />
      <Stack.Screen
        name="journal-log"
        options={{ headerShown: false, title: "Journal log" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
