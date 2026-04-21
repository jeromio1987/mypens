import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'

/**
 * Android Health Connect data must be read by an Android companion app, then
 * pushed to this server using a long-lived pairing token (same model as
 * HealthKit).
 */

export function generatePairingToken(): string {
  return `hc_${randomBytes(32).toString('base64url')}`
}

export async function issuePairingToken(deviceLabel: string | null) {
  const pairingToken = generatePairingToken()
  return prisma.healthConnectConnection.upsert({
    where: { userId: 'default' },
    update: { pairingToken, deviceLabel },
    create: { userId: 'default', pairingToken, deviceLabel },
  })
}

export async function getConnection() {
  return prisma.healthConnectConnection.findUnique({ where: { userId: 'default' } })
}

export async function verifyToken(token: string | null | undefined): Promise<boolean> {
  if (!token) return false
  const conn = await prisma.healthConnectConnection.findUnique({
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
