import { describe, expect, it } from 'vitest'
import type { InventorySetting } from './product-inventory'
import { buildSmartAlerts } from './smart-alerts'
import { STATUS } from './sheet-mapping'
import type { Order } from './types'

function order(overrides: Partial<Order> = {}): Order {
  return {
    _row: 2,
    order_id: 'TF-1',
    customerName: 'عميل',
    phone: '0550000000',
    wilaya: 'الجزائر',
    baladiya: 'الجزائر الوسطى',
    address: '',
    notes: '',
    product: 'منتج أ',
    color: '',
    size: '',
    price: 5000,
    quantity: 1,
    deliveryType: 'home',
    date: '2026-07-25',
    status: STATUS.PROCESSING,
    ...overrides,
  }
}

function setting(overrides: Partial<InventorySetting> = {}): InventorySetting {
  return {
    productName: 'منتج أ',
    unitCost: 1000,
    stockQuantity: 2,
    lowStockThreshold: 2,
    updatedAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('smart alerts', () => {
  it('flags old pending orders using parsed order dates', () => {
    const alerts = buildSmartAlerts([order()], [], new Date('2026-08-02T12:00:00.000Z'))

    expect(alerts[0]).toMatchObject({
      type: 'pending_order',
      severity: 'critical',
      destination: '/call-center',
    })
  })

  it('groups no-answer and likely duplicate orders', () => {
    const alerts = buildSmartAlerts(
      [
        order({ order_id: 'TF-1', date: '2026-08-02', status: STATUS.NO_ANSWER }),
        order({ _row: 3, order_id: 'TF-2', date: '2026-08-02' }),
      ],
      [],
      new Date('2026-08-02T12:00:00.000Z'),
    )

    expect(alerts.some((alert) => alert.type === 'no_answer')).toBe(true)
    expect(alerts.some((alert) => alert.type === 'duplicate_order')).toBe(true)
  })

  it('adds stock and missing-cost alerts for configured catalog data', () => {
    const alerts = buildSmartAlerts(
      [
        order({ status: STATUS.CONFIRMED, date: '2026-08-02', quantity: 2 }),
        order({
          _row: 3,
          order_id: 'TF-2',
          product: 'منتج ب',
          status: STATUS.DELIVERED,
          date: '2026-08-02',
        }),
      ],
      [setting()],
      new Date('2026-08-02T12:00:00.000Z'),
    )

    expect(alerts.some((alert) => alert.type === 'out_of_stock')).toBe(true)
    expect(alerts.some((alert) => alert.type === 'missing_cost')).toBe(true)
  })
})
