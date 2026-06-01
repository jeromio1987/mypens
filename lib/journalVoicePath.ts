const VOICE_PATH_RE = /^\/uploads\/journal\/[A-Za-z0-9._-]+\.(webm|mp4|m4a|ogg|opus|wav)$/

export function sanitiseJournalVoicePath(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  if (typeof raw !== 'string') return null
  if (!VOICE_PATH_RE.test(raw)) return null
  return raw
}
