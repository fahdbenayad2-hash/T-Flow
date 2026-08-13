import { getOrderReportDate } from './report-insights'
import { aggregateProductInventory, type InventorySetting } from './product-inventory'
import { buildProfitabilityInsights } from './profitability-insights'
import { STATUS } from './sheet-mapping'
import type { Notification, Order } from './types'

const HOUR_MS = 60 * 60 * 1000
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const

function getOrderDate(order: Order) {
  if (order._orderedAt) {
    const timestamp = new Date(order._orderedAt)
    if (!Number.isNaN(timestamp.getTime())) return timestamp
  }
  return getOrderReportDate(order)
}

function orderKey(order: Order) {
  return order._sourceOrderId || order.order_id || String(order._row)
}

export function buildSmartAlerts(
  orders: Order[],
  inventorySettings: InventorySetting[] = [],
  now = new Date(),
): Notification[] {
  const alerts: Notification[] = []
  const pendingStatuses = new Set<string>([STATUS.PROCESSING, STATUS.PREPARING])

  const recentOrders = orders.filter((order) => {
    if (!order._orderedAt || order.status !== STATUS.PROCESSING) return false
    const orderedAt = new Date(order._orderedAt).getTime()
    const age = now.getTime() - orderedAt
    return Number.isFinite(orderedAt) && age >= 0 && age <= HOUR_MS
  })
  if (recentOrders.length > 0) {
    alerts.push({
      id: 'new-orders',
      type: 'new_order',
      severity: 'info',
      title: 'طلبات جديدة',
      message: `${recentOrders.length} طلب وصل خلال آخر ساعة`,
      destination: '/orders',
      createdAt: recentOrders[0]._orderedAt,
    })
  }

  for (const order of orders) {
    const orderedAt = getOrderDate(order)
    if (!pendingStatuses.has(order.status) || !orderedAt) continue
    const ageHours = (now.getTime() - orderedAt.getTime()) / HOUR_MS
    if (ageHours <= 48) continue
    const ageDays = Math.max(Math.floor(ageHours / 24), 2)
    alerts.push({
      id: `pending:${orderKey(order)}`,
      type: 'pending_order',
      severity: ageHours >= 96 ? 'critical' : 'warning',
      title: 'طلب متأخر عن التأكيد',
      message: `${order.customerName || 'عميل'} · منذ ${ageDays} أيام`,
      destination: '/call-center',
      orderId: order.order_id,
      createdAt: orderedAt.toISOString(),
    })
  }

  const noAnswerCount = orders.filter((order) => order.status === STATUS.NO_ANSWER).length
  if (noAnswerCount > 0) {
    alerts.push({
      id: 'no-answer',
      type: 'no_answer',
      severity: noAnswerCount >= 5 ? 'critical' : 'warning',
      title: 'طلبات بدون رد',
      message: `${noAnswerCount} طلب يحتاج إعادة اتصال`,
      destination: '/call-center',
    })
  }

  const activeOrders = orders.filter(
    (order) => order.status !== STATUS.CANCELLED && order.status !== STATUS.DELIVERED,
  )
  const duplicateGroups = new Map<string, Order[]>()
  for (const order of activeOrders) {
    const phone = String(order.phone).replace(/\D/g, '')
    const product = order.product.trim().toLocaleLowerCase('ar')
    if (!phone || !product) continue
    const key = `${phone}:${product}`
    const current = duplicateGroups.get(key) ?? []
    current.push(order)
    duplicateGroups.set(key, current)
  }
  const duplicateOrders = Array.from(duplicateGroups.values()).filter((group) => group.length > 1)
  if (duplicateOrders.length > 0) {
    const duplicateCount = duplicateOrders.reduce((sum, group) => sum + group.length, 0)
    alerts.push({
      id: 'duplicate-orders',
      type: 'duplicate_order',
      severity: 'warning',
      title: 'طلبات مكررة محتملة',
      message: `${duplicateCount} طلباً ضمن ${duplicateOrders.length} مجموعة`,
      destination: '/orders',
      orderId: duplicateOrders[0][0].order_id,
    })
  }

  if (inventorySettings.length > 0) {
    const inventory = aggregateProductInventory(orders, inventorySettings)
    for (const product of inventory) {
      if (product.health !== 'low' && product.health !== 'out_of_stock') continue
      alerts.push({
        id: `stock:${product.name}`,
        type: product.health === 'out_of_stock' ? 'out_of_stock' : 'low_stock',
        severity: product.health === 'out_of_stock' ? 'critical' : 'warning',
        title: product.health === 'out_of_stock' ? 'مخزون نافد' : 'مخزون منخفض',
        message: `${product.name} · ${product.availableUnits ?? 0} وحدة متاحة`,
        destination: '/products',
      })
    }

    const profitability = buildProfitabilityInsights(orders, inventorySettings)
    const missingCostProducts = profitability.productEntries.filter(
      (product) => product.grossProfit === null,
    )
    if (missingCostProducts.length > 0) {
      alerts.push({
        id: 'missing-product-costs',
        type: 'missing_cost',
        severity: 'info',
        title: 'تكاليف منتجات ناقصة',
        message: `${missingCostProducts.length} منتج يمنع اكتمال حساب الربح`,
        destination: '/products',
      })
    }
  }

  return alerts
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    )
    .slice(0, 25)
}
