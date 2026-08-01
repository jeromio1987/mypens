/**
 * Build React Native FormData image parts with a reliable MIME.
 * Android camera often returns empty / odd mimeType — empty string fails server allowlists.
 */
export function normalizeImageMime(
  mimeType: string | null | undefined,
  uri?: string | null,
): { mime: string; ext: 'jpg' | 'png' | 'webp' | 'heic' } {
  const raw = (mimeType ?? '').trim().toLowerCase()
  const fromUri = (uri ?? '').split('?')[0]?.toLowerCase() ?? ''

  if (raw.includes('png') || fromUri.endsWith('.png')) return { mime: 'image/png', ext: 'png' }
  if (raw.includes('webp') || fromUri.endsWith('.webp')) return { mime: 'image/webp', ext: 'webp' }
  if (raw.includes('heic') || raw.includes('heif') || fromUri.endsWith('.heic') || fromUri.endsWith('.heif')) {
    return { mime: 'image/heic', ext: 'heic' }
  }
  // jpeg / jpg / empty / image/* / octet-stream → jpeg (camera default)
  return { mime: 'image/jpeg', ext: 'jpg' }
}

/** RN multipart file part for pensFetch FormData. */
export function appendImageFormFile(
  form: FormData,
  field: string,
  asset: { uri: string; mimeType?: string | null },
  basename: string,
): void {
  const { mime, ext } = normalizeImageMime(asset.mimeType, asset.uri)
  form.append(field, {
    uri: asset.uri,
    name: `${basename}.${ext}`,
    type: mime,
  } as unknown as Blob)
}

/** Parse JSON from API even when body is HTML / empty — never throw opaque SyntaxError. */
export async function readPensJson<T extends Record<string, unknown>>(
  res: Response,
): Promise<T & { error?: string }> {
  const text = await res.text()
  if (!text.trim()) {
    return { error: `Empty response (${res.status})` } as T & { error?: string }
  }
  try {
    return JSON.parse(text) as T & { error?: string }
  } catch {
    const snippet = text.replace(/\s+/g, ' ').slice(0, 120)
    return {
      error: `Non-JSON response (${res.status}): ${snippet || 'empty'}`,
    } as T & { error?: string }
  }
}
