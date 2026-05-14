/** Push to ntfy.sh (or self-hosted ntfy) — Tier 2-E optional leg. */

export async function pushNtfy(title: string, message: string): Promise<boolean> {
  const url = process.env.NTFY_INVESTING_URL?.trim()
  if (!url) return false
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Title: title.slice(0, 200),
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: message.slice(0, 4000),
    })
    return res.ok
  } catch {
    return false
  }
}
