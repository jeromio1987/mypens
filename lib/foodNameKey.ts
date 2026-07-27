/**
 * Normalize a food name for suggestion dedupe so "Skyr 150g" and "Skyr 200g"
 * collapse to one hit — user adjusts grams in the log UI.
 */
export function foodNameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // strip trailing / inline portion markers: 150g, 150 g, (150g), - 150g, x150g
    .replace(/\s*[(\[{]?\s*\d+([.,]\d+)?\s*(g|gr|gram|grams|kg|ml|l)\s*[)\]}]?/gi, ' ')
    .replace(/\s*(x|×)\s*\d+([.,]\d+)?\s*(g|gr|gram|grams)?\b/gi, ' ')
    .replace(/[^a-z0-9\s+&./'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
