import { Redirect } from 'expo-router'

/**
 * Legacy tab route. Real Weight hub is `index.tsx`.
 * Keep file so deep links don't 404; `_layout.tsx` sets `href: null` so it
 * does not appear in the tab bar. Redirect if somehow opened.
 */
export default function WeightStub() {
  return <Redirect href="/(tabs)" />
}
