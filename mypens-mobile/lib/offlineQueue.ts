import AsyncStorage from '@react-native-async-storage/async-storage'
import { pensFetch } from '@/lib/pensApi'

const STORAGE_KEY = '@mypens/offline_queue_v1'
const DEAD_LETTER_KEY = '@mypens/offline_dead_letter'

export type QueuedOp =
  | { id: string; type: 'weight_post'; payload: Record<string, unknown>; createdAt: string }
  | { id: string; type: 'sleep_post'; payload: Record<string, unknown>; createdAt: string }
  | { id: string; type: 'training_post'; payload: Record<string, unknown>; createdAt: string }
  | { id: string; type: 'training_delete'; payload: { id: string }; createdAt: string }
  | { id: string; type: 'food_post'; payload: Record<string, unknown>; createdAt: string }
  | { id: string; type: 'food_patch'; payload: Record<string, unknown>; createdAt: string }
  | { id: string; type: 'food_delete'; payload: { id: string }; createdAt: string }
  | { id: string; type: 'journal_post'; payload: Record<string, unknown>; createdAt: string }
  | { id: string; type: 'journal_delete'; payload: { id: string }; createdAt: string }
  | { id: string; type: 'measurements_post'; payload: Record<string, unknown>; createdAt: string }

export type DeadLetterOp = QueuedOp & {
  droppedAt: string
  status: number
}

export type FlushOutcome = 'success' | 'retry' | 'dead_letter'

/**
 * Classify an HTTP status for offline flush.
 * 401/403 stay in queue (token/config) — same as 5xx.
 * Other 4xx are genuinely rejected → dead letter.
 */
export function classifyFlushStatus(
  status: number,
  opts?: { treat404AsSuccess?: boolean },
): FlushOutcome {
  if (status >= 200 && status < 300) return 'success'
  if (opts?.treat404AsSuccess && status === 404) return 'success'
  if (status === 401 || status === 403 || status >= 500) return 'retry'
  if (status >= 400 && status < 500) return 'dead_letter'
  return 'retry'
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function readQueue(): Promise<QueuedOp[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as QueuedOp[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeQueue(q: QueuedOp[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(q))
}

export async function readDeadLetter(): Promise<DeadLetterOp[]> {
  try {
    const raw = await AsyncStorage.getItem(DEAD_LETTER_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DeadLetterOp[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function appendDeadLetter(op: QueuedOp, status: number) {
  const prev = await readDeadLetter()
  prev.push({ ...op, droppedAt: new Date().toISOString(), status })
  // Cap so a stuck client cannot grow forever
  const capped = prev.slice(-100)
  await AsyncStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(capped))
}

export async function enqueueOp(
  op: Omit<QueuedOp, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): Promise<void> {
  const full: QueuedOp = {
    ...op,
    id: op.id ?? newId(),
    createdAt: op.createdAt ?? new Date().toISOString(),
  } as QueuedOp
  const q = await readQueue()
  q.push(full)
  await writeQueue(q)
}

export async function queueLength(): Promise<number> {
  return (await readQueue()).length
}

/** Module-scope lock — N usePensSync / callers collapse to one flush (no duplicate POSTs). */
let inFlight: Promise<{
  flushed: number
  remaining: number
  droppedBad: number
}> | null = null

/**
 * Replay queued MY PENS API calls.
 * Removes successes. Retries 5xx, network errors, and 401/403.
 * Genuinely rejected 4xx → dead-letter store (not silent drop).
 */
export async function flushOfflineQueue(options?: { max?: number }): Promise<{
  flushed: number
  remaining: number
  droppedBad: number
}> {
  if (inFlight) return inFlight
  inFlight = flushOfflineQueueInner(options).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function flushOfflineQueueInner(options?: { max?: number }): Promise<{
  flushed: number
  remaining: number
  droppedBad: number
}> {
  const max = options?.max ?? 50
  const q = await readQueue()
  const keep: QueuedOp[] = []
  let flushed = 0
  let droppedBad = 0
  const jsonHeaders = { 'Content-Type': 'application/json' }

  for (const op of q) {
    if (flushed >= max) {
      keep.push(op)
      continue
    }
    try {
      let res: Response
      switch (op.type) {
        case 'weight_post':
          res = await pensFetch('/api/weight', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(op.payload),
          })
          break
        case 'sleep_post':
          res = await pensFetch('/api/sleep', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(op.payload),
          })
          break
        case 'training_post':
          res = await pensFetch('/api/training', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(op.payload),
          })
          break
        case 'training_delete':
          res = await pensFetch('/api/training', {
            method: 'DELETE',
            headers: jsonHeaders,
            body: JSON.stringify(op.payload),
          })
          break
        case 'food_post':
          res = await pensFetch('/api/food', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(op.payload),
          })
          break
        case 'food_patch':
          res = await pensFetch('/api/food', {
            method: 'PATCH',
            headers: jsonHeaders,
            body: JSON.stringify(op.payload),
          })
          break
        case 'food_delete':
          res = await pensFetch('/api/food', {
            method: 'DELETE',
            headers: jsonHeaders,
            body: JSON.stringify(op.payload),
          })
          break
        case 'journal_post':
          res = await pensFetch('/api/journal', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(op.payload),
          })
          break
        case 'journal_delete':
          res = await pensFetch(`/api/journal?id=${encodeURIComponent(op.payload.id)}`, {
            method: 'DELETE',
          })
          break
        case 'measurements_post':
          res = await pensFetch('/api/measurements', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(op.payload),
          })
          break
        default:
          keep.push(op as QueuedOp)
          continue
      }

      const treat404AsSuccess =
        op.type === 'journal_delete' || op.type === 'training_delete'
      const outcome = classifyFlushStatus(res.status, { treat404AsSuccess })
      if (outcome === 'success') {
        flushed++
      } else if (outcome === 'retry') {
        keep.push(op)
      } else {
        droppedBad++
        await appendDeadLetter(op, res.status)
      }
    } catch {
      keep.push(op)
    }
  }

  await writeQueue(keep)
  return { flushed, remaining: keep.length, droppedBad }
}
