import React from 'react'
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

/** Drinking Indian / Native American PENS caricature — require icon.png; do not replace without Jerome’s explicit ask. */
const LOGO = require('../assets/images/icon.png')

type Props = {
  size?: number
  style?: StyleProp<ViewStyle>
}

/** In-app brand mark. Native launcher/splash must be regenerated when icon.png changes. */
export function PensLogo({ size = 40, style }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.22 }, style]}>
      <Image source={LOGO} style={{ width: size, height: size }} accessibilityLabel="myPENS" />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#E8B84A',
  },
})
