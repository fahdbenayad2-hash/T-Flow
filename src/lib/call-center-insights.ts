import { STATUS } from './sheet-mapping'
import type { CallLog, Order } from './types'

export type QueueBucket = 'due' | 'retry' | 'new' | 'scheduled'

export interface CallQueueItem {
  order: Order
  attempts: number
  latestLog: CallLog | null
  bucket: QueueBucket
  priority: number
}

const QUEUE_STATUSES = new Set<string>([STATUS.PROCESSING, STATUS.PREPARING, STATUS.NO_ANSWER])

export function buildCallQueue(
  orders: Order[],
  logs: CallLog[],
  now = new Date(),
): CallQueueItem[] {
  const logsByOrder = new Map<string, CallLog[]>()

  for (const log of logs) {
    const current = logsByOrder.get(log.order_id) || []
    current.push(log)
    logsByOrder.set(log.order_id, current)
  }

  return orders
    .filter((order) => QUEUE_STATUSES.has(order.status))
    .map((order) => {
      const orderLogs = (logsByOrder.get(order.order_id) || []).sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      )
      const latestLog = orderLogs[0] || null

      if (latestLog?.outcome === 'postponed' && latestLog.follow_up_at) {
        const isDue = new Date(latestLog.follow_up_at).getTime() <= now.getTime()
        return {
          order,
          attempts: orderLogs.length,
          latestLog,
          bucket: isDue ? ('due' as const) : ('scheduled' as const),
          priority: isDue ? 0 : 3,
        }
      }

      if (order.status === STATUS.NO_ANSWER || latestLog?.outcome === 'no_answer') {
        return {
          order,
          attempts: orderLogs.length,
          latestLog,
          bucket: 'retry' as const,
          priority: 1,
        }
      }

      return {
        order,
        attempts: orderLogs.length,
        latestLog,
        bucket: 'new' as const,
        priority: 2,
      }
    })
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.latestLog?.follow_up_at || '').localeCompare(b.latestLog?.follow_up_at || '') ||
        b.order._row - a.order._row,
    )
}

export function getTodayCallStats(logs: CallLog[], now = new Date()) {
  const localDate = now.toLocaleDateString('en-CA')
  const todayLogs = logs.filter(
    (log) => new Date(log.created_at).toLocaleDateString('en-CA') === localDate,
  )

  return {
    answered: todayLogs.filter((log) => log.outcome === 'answered').length,
    noAnswer: todayLogs.filter((log) => log.outcome === 'no_answer').length,
    postponed: todayLogs.filter((log) => log.outcome === 'postponed').length,
    total: todayLogs.length,
  }
}
