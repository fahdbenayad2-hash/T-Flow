import { parseOrderDate } from './order-record'
import type { Order } from './types'

export type OrderSortField = '_row' | 'customer' | 'date' | 'status'
export type OrderSortDirection = 'asc' | 'desc'

function compareNumbers(a: number, b: number): number {
  if (a === b) return 0
  return a > b ? 1 : -1
}

function compareText(a: unknown, b: unknown): number {
  return String(a ?? '').localeCompare(String(b ?? ''), 'ar', {
    numeric: true,
    sensitivity: 'base',
  })
}

export function getOrderTimestamp(order: Order): number {
  const parsedDate = order._orderedAt || parseOrderDate(order.date)
  const timestamp = parsedDate ? Date.parse(parsedDate) : Number.NaN
  if (Number.isFinite(timestamp)) return timestamp

  const lastModified = Number(order.lastModified)
  return Number.isFinite(lastModified) ? lastModified : Number.NEGATIVE_INFINITY
}

/**
 * Keeps the order list deterministic even when several Sheet rows share the
 * same day. Newer dates come first by default, then the latest Sheet row.
 */
export function compareOrders(
  a: Order,
  b: Order,
  field: OrderSortField,
  direction: OrderSortDirection,
): number {
  const primary =
    field === '_row'
      ? compareNumbers(a._row, b._row)
      : field === 'customer'
        ? compareText(a.customerName, b.customerName)
        : field === 'date'
          ? compareNumbers(getOrderTimestamp(a), getOrderTimestamp(b))
          : compareText(a.status, b.status)

  if (primary !== 0) return direction === 'asc' ? primary : -primary

  const rowTieBreak = compareNumbers(b._row, a._row)
  if (rowTieBreak !== 0) return rowTieBreak

  const modifiedTieBreak = compareNumbers(Number(b.lastModified) || 0, Number(a.lastModified) || 0)
  if (modifiedTieBreak !== 0) return modifiedTieBreak

  return compareText(a._sourceOrderId || a.order_id, b._sourceOrderId || b.order_id)
}
