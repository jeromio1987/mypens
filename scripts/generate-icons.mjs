#!/usr/bin/env node
// Generates the PWA icons from a small inline SVG.
// Output: public/icon-192.png, public/icon-512.png, public/icon-512-maskable.png,
// and public/apple-touch-icon.png (180x180).
import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'

const DEEP    = '#0D1B2A'
const CRIMSON = '#8B1E1E'
const CREAM   = '#F5E6D3'
const GOLD    = '#C9A84C'

// Standard square logo: deep background, crimson accent ring, "MP" wordmark in cream.
function svgStandard(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${DEEP}"/>
  <circle cx="256" cy="256" r="220" fill="none" stroke="${CRIMSON}" stroke-width="14"/>
  <text x="256" y="298" font-family="Georgia, serif" font-size="180" font-weight="700"
        text-anchor="middle" fill="${CREAM}">MP</text>
  <rect x="180" y="370" width="152" height="6" fill="${GOLD}"/>
</svg>`
}

// Maskable: keep all important content within the safe zone (inner 80%).
// Background extends edge-to-edge so OS masks (circle, squircle) look intentional.
function svgMaskable(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${DEEP}"/>
  <text x="256" y="305" font-family="Georgia, serif" font-size="160" font-weight="700"
        text-anchor="middle" fill="${CREAM}">MP</text>
  <rect x="186" y="365" width="140" height="6" fill="${CRIMSON}"/>
</svg>`
}

async function render(svg, size, out) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  await writeFile(out, buf)
  console.log(`  → ${out} (${size}x${size})`)
}

await render(svgStandard(192), 192, 'public/icon-192.png')
await render(svgStandard(512), 512, 'public/icon-512.png')
await render(svgMaskable(512), 512, 'public/icon-512-maskable.png')
await render(svgStandard(180), 180, 'public/apple-touch-icon.png')
console.log('done.')
