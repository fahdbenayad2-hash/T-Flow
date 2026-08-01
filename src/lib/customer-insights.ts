import { STATUS } from './sheet-mapping'
import type { Customer, Order } from './types'
import { getOrderTotal } from './order-record'

export type CustomerSegment = 'new' | 'loyal' | 'needs_follow_up'

export interface CustomerInsight {
  deliveredCount: number
  failedCount: number
  deliveryRate: number
  segment: CustomerSegment
  segmentLabel: string
  segmentHint: string
}

export interface CustomerValueSummary {
  spent: number
  active: number
  lost: number
}

export function getCustomerValueSummary(orders: Order[]): CustomerValueSummary {
  return orders.reduce<CustomerValueSummary>(
    (summary, order) => {
      const value = getOrderTotal(order)
      if (order.status === STATUS.DELIVERED) summary.spent += value
      else if (order.status === STATUS.CANCELLED || order.status === STATUS.NO_ANSWER) {
        summary.lost += value
      } else {
        summary.active += value
      }
      return summary
    },
    { spent: 0, active: 0, lost: 0 },
  )
}

export function aggregateCustomers(orders: Order[]): Customer[] {
  const customers = new Map<string, Customer>()

  for (const order of orders) {
    const phone = String(order.phone).trim()
    if (!phone) continue

    if (!customers.has(phone)) {
      customers.set(phone, {
        phone,
        name: order.customerName,
        orders: [],
        totalOrders: 0,
        totalSpent: 0,
        cancelledCount: 0,
        noAnswerCount: 0,
        lastOrderDate: order.date,
        isBlacklisted: false,
      })
    }

    const customer = customers.get(phone)!
    customer.orders.push(order)
    customer.totalOrders += 1
    if (order.status === STATUS.DELIVERED) customer.totalSpent += getOrderTotal(order)

    if (order.status === STATUS.CANCELLED) customer.cancelledCount += 1
    if (order.status === STATUS.NO_ANSWER) customer.noAnswerCount += 1
    if (order.date > customer.lastOrderDate) customer.lastOrderDate = order.date
  }

  return Array.from(customers.values()).sort(
    (a, b) => b.totalSpent - a.totalSpent || b.totalOrders - a.totalOrders,
  )
}

export function getCustomerInsight(customer: Customer): CustomerInsight {
  const deliveredCount = customer.orders.filter((order) => order.status === STATUS.DELIVERED).length
  const failedCount = customer.cancelledCount + customer.noAnswerCount
  const completedOrders = deliveredCount + failedCount
  const deliveryRate =
    completedOrders > 0 ? Math.round((deliveredCount / completedOrders) * 100) : 0

  if (customer.totalOrders >= 2 && failedCount >= 2 && failedCount > deliveredCount) {
    return {
      deliveredCount,
      failedCount,
      deliveryRate,
      segment: 'needs_follow_up',
      segmentLabel: 'يحتاج متابعة',
      segmentHint: 'سجل الطلبات يحتوي على محاولات غير ناجحة متكررة',
    }
  }

  if (customer.totalOrders >= 2 && deliveredCount >= failedCount) {
    return {
      deliveredCount,
      failedCount,
      deliveryRate,
      segment: 'loyal',
      segmentLabel: 'عميل موثوق',
      segmentHint: 'لديه سجل طلبات متكرر ونتائج توصيل جيدة',
    }
  }

  return {
    deliveredCount,
    failedCount,
    deliveryRate,
    segment: 'new',
    segmentLabel: 'عميل جديد',
    segmentHint: 'لا توجد بيانات كافية للحكم على سجل العميل بعد',
  }
}

export function normalizeAlgerianPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('213')) return `+${digits}`
  if (digits.startsWith('0')) return `+213${digits.slice(1)}`
  if (digits.length === 9) return `+213${digits}`

  return `+${digits}`
}
