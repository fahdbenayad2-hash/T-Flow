import { describe, expect, it } from 'vitest'
import {
  aggregateCustomers,
  getCustomerInsight,
  getCustomerValueSummary,
  normalizeAlgerianPhone,
} from './customer-insights'
import { STATUS } from './sheet-mapping'
import type { Order } from './types'

function order(overrides: Partial<Order>): Order {
  return {
    _row: 2,
    order_id: 'TF-1',
    customerName: 'عميل تجريبي',
    phone: '0550000000',
    wilaya: 'الجزائر',
    baladiya: 'الجزائر الوسطى',
    address: '',
    notes: '',
    product: 'منتج',
    color: '',
    size: '',
    price: 1000,
    quantity: 1,
    deliveryType: 'منزل',
    date: '2026-07-30',
    status: STATUS.PROCESSING,
    ...overrides,
  }
}

describe('customer insights', () => {
  it('counts only delivered orders as customer spending', () => {
    const customers = aggregateCustomers([
      order({ phone: '0550000000', price: 1000, quantity: 2 }),
      order({ phone: '0550000000', price: 500, status: STATUS.DELIVERED }),
      order({
        phone: '0660000000',
        customerName: 'عميل آخر',
        price: 1200,
        status: STATUS.DELIVERED,
      }),
    ])

    expect(customers[0]).toMatchObject({
      phone: '0660000000',
      totalOrders: 1,
      totalSpent: 1200,
    })
    expect(customers[1].totalSpent).toBe(500)
  })

  it('separates delivered, active, and failed order value', () => {
    expect(
      getCustomerValueSummary([
        order({ price: 2500, status: STATUS.DELIVERED }),
        order({ price: 1800, status: STATUS.CONFIRMED }),
        order({ price: 900, status: STATUS.CANCELLED }),
      ]),
    ).toEqual({ spent: 2500, active: 1800, lost: 900 })
  })

  it('marks a successful repeat customer as loyal', () => {
    const [customer] = aggregateCustomers([
      order({ status: STATUS.DELIVERED }),
      order({ _row: 3, order_id: 'TF-2', status: STATUS.DELIVERED }),
    ])

    expect(getCustomerInsight(customer)).toMatchObject({
      segment: 'loyal',
      deliveryRate: 100,
    })
  })

  it('only flags repeated failed attempts for follow-up', () => {
    const [customer] = aggregateCustomers([
      order({ status: STATUS.CANCELLED }),
      order({ _row: 3, order_id: 'TF-2', status: STATUS.NO_ANSWER }),
    ])

    expect(getCustomerInsight(customer).segment).toBe('needs_follow_up')
  })

  it('normalizes common Algerian phone formats', () => {
    expect(normalizeAlgerianPhone('0550 00 00 00')).toBe('+213550000000')
    expect(normalizeAlgerianPhone('550000000')).toBe('+213550000000')
  })
})
