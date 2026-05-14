/**
 * Usage: npm run qr:url -- http://YOUR_IP:3000 [optional-output.png]
 * Avoids `npx -y qrcode`, which can hit Windows error 32 (file in use) on cache/extract.
 */
const QRCode = require('qrcode')

const url = process.argv[2]
const out = process.argv[3] || 'pens-web-qr.png'

if (!url) {
  console.error('Usage: npm run qr:url -- <url> [output.png]')
  console.error('Example: npm run qr:url -- http://192.168.1.42:3000')
  process.exit(1)
}

QRCode.toFile(out, url, { width: 320, margin: 2 })
  .then(() => console.log('Wrote', out))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
