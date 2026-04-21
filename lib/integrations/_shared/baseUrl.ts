/** Resolve a trusted base URL for the running app. */
export function getAppBaseUrl(req: Request): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (explicit) return explicit
  const dev = process.env.REPLIT_DEV_DOMAIN
  if (dev) return `https://${dev}`
  const url = new URL(req.url)
  const host = req.headers.get('x-forwarded-host') ?? url.host
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${host}`
}
