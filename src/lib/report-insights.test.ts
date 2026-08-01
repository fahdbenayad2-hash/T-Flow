import { describe, expect, it } from 'vitest'
import { STATUS } from './sheet-mapping'
import type { Order } from './types'
import { buildReportInsights, filterOrdersByReportRange } from './report-insights'

function order(overrides: Partial<Order> = {}): Order {
  return {
    _row: 2,
    order_id: 'FS-1',
    customerName: 'عميل',
    phone: '0550000000',
    wilaya: 'الجزائر',
    baladiya: 'الجزائر',
    address: '',
    notes: '',
    product: 'منتج',
    color: '',
    size: '',
    price: 3000,
    quantity: 1,
    deliveryType: 'home',
    date: '2026-07-30',
    status: STATUS.PROCESSING,
    ...overrides,
  }
}

describe('report insights', () => {
  it('filters rolling and custom date ranges', () => {
    const orders = [
      order({ order_id: 'today', date: '2026-07-30' }),
      order({ order_id: 'week', date: '25/07/2026 12:00:00' }),
      order({ order_id: 'old', date: '2026-06-01' }),
    ]
    const now = new Date(2026, 6, 30, 12)

    expect(filterOrdersByReportRange(orders, { range: 'today', now })).toHaveLength(1)
    expect(filterOrdersByReportRange(orders, { range: '7d', now })).toHaveLength(2)
    expect(
      filterOrdersByReportRange(orders, {
        range: 'custom',
        now,
        customStart: '2026-06-01',
        customEnd: '2026-06-01',
      }),
    ).toHaveLength(1)
  })

  it('calculates revenue, delivery rate, and breakdowns', () => {
    const insights = buildReportInsights([
      order({ status: STATUS.DELIVERED, price: '3.000', quantity: 2 }),
      order({
        _row: 3,
        order_id: 'FS-2',
        phone: '0660000000',
        wilaya: 'وهران',
        product: 'منتج آخر',
        status: STATUS.CANCELLED,
      }),
    ])

    expect(insights.totalOrders).toBe(2)
    expect(insights.totalUnits).toBe(3)
    expect(insights.uniqueCustomers).toBe(2)
    expect(insights.totalRevenue).toBe(3000)
    expect(insights.averageOrderValue).toBe(3000)
    expect(insights.deliveryRate).toBe(50)
    expect(insights.wilayas[0]).toMatchObject({ orders: 1 })
    expect(insights.statusBreakdown).toHaveLength(2)
  })
})
