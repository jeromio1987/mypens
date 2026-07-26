/** Continental design tokens — new Audit stack screens only. */

export const continental = {
  bg: '#061423',
  surfaceLowest: '#020F1E',
  surfaceLow: '#0F1C2C',
  surfaceHigh: '#1E2B3B',
  surfaceHighest: '#283646',
  cream: '#C6C7C3',
  creamMuted: 'rgba(198,199,195,0.55)',
  creamDim: 'rgba(198,199,195,0.35)',
  onPrimary: '#2F312E',
  oxblood: '#FFB4A8',
  oxbloodDeep: '#550000',
  secondaryContainer: '#3E4960',
  outlineGhost: 'rgba(69,71,77,0.15)',
  radius: 0,
  fonts: {
    display: 'Georgia',
    label: 'System',
    body: 'System',
  },
} as const

export type ContinentalTokens = typeof continental
