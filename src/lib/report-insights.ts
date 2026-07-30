import { parseOrderDate, parseOrderPrice, parseOrderQuantity } from './order-record'
import { ALL_STATUSES, STATUS } from './sheet-mapping'
import type { Order } from './types'

export type ReportRange = 'all' | 'today' | '7d' | '30d' | 'custom'

export interface ReportRangeOptions {
  range: ReportRange
  now?: Date
  customStart?: string
  customEnd?: string
}

export interface ReportBreakdownItem {
  label: string
  orders: number
  delivered: number
  revenue: number
  rate: number
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function parseLocalInput(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getOrderReportDate(order: Order) {
  const parsed = parseOrderDate(order.date)
  return parsed ? new Date(parsed) : null
}

export function filterOrdersByReportRange(orders: Order[], options: ReportRangeOptions) {
  if (options.range === 'all') return orders

  const now = options.now ?? new Date()
  let start = startOfLocalDay(now)
  let end = endOfLocalDay(now)

  if (options.range === '7d' || options.range === '30d') {
    start.setDate(start.getDate() - (options.range === '7d' ? 6 : 29))
  }

  if (options.range === 'custom') {
    const customStart = parseLocalInput(options.customStart)
    const customEnd = parseLocalInput(options.customEnd)
    if (!customStart && !customEnd) return orders
    if (customStart) start = startOfLocalDay(customStart)
    else start = new Date(0)
    if (customEnd) end = endOfLocalDay(customEnd)
  }

  return orders.filter((order) => {
    const orderDate = getOrderReportDate(order)
    return orderDate ? orderDate >= start && orderDate <= end : false
  })
}

function aggregateBreakdown(orders: Order[], key: (order: Order) => string) {
  const map = new Map<string, Omit<ReportBreakdownItem, 'label' | 'rate'>>()

  for (const order of orders) {
    const label = key(order).trim() || 'غير محدد'
    const current = map.get(label) ?? { orders: 0, delivered: 0, revenue: 0 }
    current.orders += 1
    if (order.status === STATUS.DELIVERED) {
      current.delivered += 1
      current.revenue += parseOrderPrice(order.price) * parseOrderQuantity(order.quantity)
    }
    map.set(label, current)
  }

  return Array.from(map.entries())
    .map(([label, item]) => ({
      label,
      ...item,
      rate: item.orders ? Math.round((item.delivered / item.orders) * 100) : 0,
    }))
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildReportInsights(orders: Order[]) {
  const delivered = orders.filter((order) => order.status === STATUS.DELIVERED)
  const totalRevenue = delivered.reduce(
    (sum, order) => sum + parseOrderPrice(order.price) * parseOrderQuantity(order.quantity),
    0,
  )
  const totalUnits = orders.reduce((sum, order) => sum + parseOrderQuantity(order.quantity), 0)
  const uniqueCustomers = new Set(orders.map((order) => String(order.phone).trim()).filter(Boolean))
    .size

  const statusCounts = new Map<string, number>()
  for (const order of orders) {
    statusCounts.set(order.status, (statusCounts.get(order.status) ?? 0) + 1)
  }

  const knownStatuses = ALL_STATUSES.map((status) => ({
    label: status,
    count: statusCounts.get(status) ?? 0,
    percentage: orders.length
      ? Math.round(((statusCounts.get(status) ?? 0) / orders.length) * 100)
      : 0,
  }))
  const extraStatuses = Array.from(statusCounts.entries())
    .filter(([status]) => !ALL_STATUSES.includes(status as (typeof ALL_STATUSES)[number]))
    .map(([label, count]) => ({
      label,
      count,
      percentage: orders.length ? Math.round((count / orders.length) * 100) : 0,
    }))

  const dailyMap = new Map<string, { orders: number; delivered: number; revenue: number }>()
  for (const order of orders) {
    const date = getOrderReportDate(order)
    if (!date) continue
    const key = toLocalDateKey(date)
    const current = dailyMap.get(key) ?? { orders: 0, delivered: 0, revenue: 0 }
    current.orders += 1
    if (order.status === STATUS.DELIVERED) {
      current.delivered += 1
      current.revenue += parseOrderPrice(order.price) * parseOrderQuantity(order.quantity)
    }
    dailyMap.set(key, current)
  }

  return {
    totalOrders: orders.length,
    totalUnits,
    uniqueCustomers,
    deliveredCount: delivered.length,
    totalRevenue,
    averageOrderValue: delivered.length ? Math.round(totalRevenue / delivered.length) : 0,
    deliveryRate: orders.length ? Math.round((delivered.length / orders.length) * 100) : 0,
    statusBreakdown: [...knownStatuses, ...extraStatuses]
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count),
    dailyTrend: Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, item]) => ({ date, ...item })),
    wilayas: aggregateBreakdown(orders, (order) => String(order.wilaya)),
    products: aggregateBreakdown(orders, (order) => order.product),
  }
}
