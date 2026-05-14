/**
 * Tier 2-F — ultra-light headline sentiment from Google News RSS.
 * Heuristic only; dismissible by design. Not a research product.
 */

const POS = /\b(surge|soar|rally|gain|beat|upgrade|bull|growth|record|profit|strong|optim)\b/i
const NEG = /\b(slump|plunge|crash|fall|miss|downgrade|bear|loss|weak|lawsuit|fraud|cut)\b/i

export type HeadlineSentiment = {
  symbol: string
  score: number // -1 … 1
  sample: string[]
  headlineCount: number
}

export async function sentimentForSymbol(symbol: string): Promise<HeadlineSentiment> {
  const q = encodeURIComponent(`${symbol} stock`)
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; mypens-investing-sentiment/1.0; +https://github.com/jeromio1987/mypens)',
    },
    next: { revalidate: 900 },
  })

  if (!res.ok) {
    return { symbol, score: 0, sample: [], headlineCount: 0 }
  }

  const xml = await res.text()
  const cdata = [...xml.matchAll(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/gi)].map(m => m[1]?.trim() ?? '')
  const plain = [...xml.matchAll(/<title>([^<]+)<\/title>/gi)].map(m => m[1]?.trim() ?? '')
  const titles = [...cdata, ...plain]
    .filter(t => t && !/^News about/i.test(t) && t !== 'Google News')
    .filter((t, i, a) => a.indexOf(t) === i)

  let pos = 0
  let neg = 0
  const sample: string[] = []
  for (const t of titles.slice(0, 25)) {
    if (POS.test(t)) pos++
    if (NEG.test(t)) neg++
    if (sample.length < 4) sample.push(t)
  }

  const n = pos + neg
  const score = n === 0 ? 0 : (pos - neg) / n

  return {
    symbol: symbol.toUpperCase(),
    score: Math.round(score * 100) / 100,
    sample,
    headlineCount: titles.length,
  }
}
