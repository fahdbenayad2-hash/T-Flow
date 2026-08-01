import { describe, expect, it } from 'vitest'
import { compareOrders } from './order-sorting'
import type { Order } from './types'

function makeOrder(overrides: Partial<Order>): Order {
  return {
    _row: 2,
    order_id: 'ORDER-2',
    customerName: 'Customer',
    phone: '0555000000',
    wilaya: 'Alger',
    baladiya: '',
    address: '',
    notes: '',
    product: 'Product',
    color: '',
    size: '',
    price: 1000,
    quantity: 1,
    deliveryType: '',
    date: '01/08/2026',
    status: 'pending',
    ...overrides,
  }
}

describe('order sorting', () => {
  it('sorts dates chronologically instead of comparing their text', () => {
    const july = makeOrder({ _row: 20, date: '31/07/2026' })
    const august = makeOrder({ _row: 3, date: '01/08/2026' })

    expect([july, august].sort((a, b) => compareOrders(a, b, 'date', 'desc'))).toEqual([
      august,
      july,
    ])
  })

  it('uses the exact database timestamp when it is available', () => {
    const morning = makeOrder({ _row: 20, _orderedAt: '2026-08-01T08:00:00.000Z' })
    const evening = makeOrder({ _row: 3, _orderedAt: '2026-08-01T18:00:00.000Z' })

    expect([morning, evening].sort((a, b) => compareOrders(a, b, 'date', 'desc'))).toEqual([
      evening,
      morning,
    ])
  })

  it('uses the latest Sheet row when dates are identical', () => {
    const olderRow = makeOrder({ _row: 5 })
    const newerRow = makeOrder({ _row: 18 })

    expect([olderRow, newerRow].sort((a, b) => compareOrders(a, b, 'date', 'desc'))).toEqual([
      newerRow,
      olderRow,
    ])
  })

  it('uses the OAuth source row when the database sheet row is empty', () => {
    const olderRow = makeOrder({ _row: 0, _sourceRow: 208, order_id: '208' })
    const newerRow = makeOrder({ _row: 0, _sourceRow: 233, order_id: '233' })

    expect([olderRow, newerRow].sort((a, b) => compareOrders(a, b, 'date', 'desc'))).toEqual([
      newerRow,
      olderRow,
    ])
  })

  it('sorts customer names independently from Sheet row numbers', () => {
    const zed = makeOrder({ _row: 100, customerName: 'Zed' })
    const alice = makeOrder({ _row: 2, customerName: 'Alice' })

    expect([zed, alice].sort((a, b) => compareOrders(a, b, 'customer', 'asc'))).toEqual([
      alice,
      zed,
    ])
  })
})
