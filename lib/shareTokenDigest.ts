import crypto from 'node:crypto'

/** SHA-256 hex digest of the raw share token (for DB lookup / revoke). */
export function shareTokenDigest(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex')
}
