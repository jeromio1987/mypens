import AsyncStorage from '@react-native-async-storage/async-storage'
import { pensFetch } from '@/lib/pensApi'

const STORAGE_KEY = '@mypens/offline_queue_v1'

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

/**
 * Replay queued MY PENS API calls. Removes successful ops. Retries 5xx and network errors.
 * Drops 4xx (bad payload) so the queue cannot block forever.
 */
export async function flushOfflineQueue(options?: { max?: number }): Promise<{
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

      const ok =
        res.ok ||
        ((op.type === 'journal_delete' || op.type === 'training_delete') && res.status === 404)
      if (ok) {
        flushed++
      } else if (res.status >= 500) {
        keep.push(op)
      } else {
        droppedBad++
      }
    } catch {
      keep.push(op)
    }
  }

  await writeQueue(keep)
  return { flushed, remaining: keep.length, droppedBad }
}
