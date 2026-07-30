import { describe, expect, it } from 'vitest'
import { buildDeliveryItems, getDeliveryStats, isHomeDeliveryType } from './delivery-operations'
import { STATUS } from './sheet-mapping'
import type { Order } from './types'

function order(overrides: Partial<Order> = {}): Order {
  return {
    _row: 2,
    order_id: 'TF-1',
    customerName: 'عميل',
    phone: '0550000000',
    wilaya: 'الجزائر',
    baladiya: 'باب الزوار',
    address: '',
    notes: '',
    product: 'منتج',
    color: '',
    size: '',
    price: 3000,
    quantity: 1,
    deliveryType: 'توصيل للمنزل',
    date: '2026-07-30',
    status: STATUS.CONFIRMED,
    ...overrides,
  }
}

describe('delivery operations', () => {
  it('classifies actionable shipping stages', () => {
    const items = buildDeliveryItems([
      order(),
      order({ _row: 3, order_id: 'TF-2', status: STATUS.SHIPPED }),
      order({ _row: 4, order_id: 'TF-3', status: STATUS.DELIVERED }),
      order({ _row: 5, order_id: 'TF-4', status: STATUS.PROCESSING }),
    ])

    expect(items.map((item) => item.stage)).toEqual(['ready', 'in_transit', 'delivered'])
  })

  it('calculates COD amount only for active shipments', () => {
    const stats = getDeliveryStats(
      buildDeliveryItems([
        order({ price: 3000 }),
        order({ _row: 3, order_id: 'TF-2', status: STATUS.SHIPPED, price: 2000 }),
        order({ _row: 4, order_id: 'TF-3', status: STATUS.DELIVERED, price: 4000 }),
      ]),
    )

    expect(stats).toMatchObject({ ready: 1, inTransit: 1, delivered: 1, collectableAmount: 5000 })
  })

  it('recognizes common home delivery labels', () => {
    expect(isHomeDeliveryType('توصيل للمنزل')).toBe(true)
    expect(isHomeDeliveryType('Home Delivery')).toBe(true)
    expect(isHomeDeliveryType('Stop Desk')).toBe(false)
  })
})
