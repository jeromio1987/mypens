import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'

/**
 * HealthKit data is only readable from inside an iOS app, so this integration
 * uses a "pairing token" model: the web app mints a long-lived bearer token,
 * the user copies it into the companion iOS app, and the app POSTs workouts to
 * `/api/integrations/healthkit/ingest` using that token.
 */

export function generatePairingToken(): string {
  // 32 bytes → 43-char base64url, prefixed for easy identification
  return `hk_${randomBytes(32).toString('base64url')}`
}

export async function issuePairingToken(deviceLabel: string | null) {
  const pairingToken = generatePairingToken()
  return prisma.healthkitConnection.upsert({
    where: { userId: 'default' },
    update: { pairingToken, deviceLabel },
    create: { userId: 'default', pairingToken, deviceLabel },
  })
}

export async function getConnection() {
  return prisma.healthkitConnection.findUnique({ where: { userId: 'default' } })
}

/** Verify a bearer token against the stored pairing token. */
export async function verifyToken(token: string | null | undefined): Promise<boolean> {
  if (!token) return false
  const conn = await prisma.healthkitConnection.findUnique({
    where: { userId: 'default' },
    select: { pairingToken: true },
  })
  return Boolean(conn && conn.pairingToken === token)
}

export function bearerFromRequest(req: Request): string | null {
  const auth = req.headers.get('authorization')
  if (!auth) return null
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}
