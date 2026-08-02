import { describe, expect, it } from 'vitest'
import {
  countOrdersInCurrentMonth,
  getTrialDaysRemaining,
  getUsagePercent,
  getUsageStatus,
} from './subscription-plans'
import type { Order } from './types'

function order(date: string, orderedAt?: string): Order {
  return {
    _row: 2,
    _orderedAt: orderedAt,
    order_id: date,
    customerName: '',
    phone: '',
    wilaya: '',
    baladiya: '',
    address: '',
    notes: '',
    product: '',
    color: '',
    size: '',
    price: 0,
    quantity: 1,
    deliveryType: '',
    date,
    status: 'قيد المعالجة',
  }
}

describe('subscription usage', () => {
  it('counts only orders in the current Algiers month', () => {
    const orders = [
      order('01/08/2026 10:00:00'),
      order('', '2026-07-31T23:30:00.000Z'),
      order('30/07/2026 10:00:00'),
      order('invalid'),
    ]
    expect(countOrdersInCurrentMonth(orders, new Date('2026-08-02T12:00:00.000Z'))).toBe(2)
  })

  it('classifies plan usage without penalizing unlimited resources', () => {
    expect(getUsagePercent(8, 10)).toBe(80)
    expect(getUsageStatus(8, 10)).toBe('warning')
    expect(getUsageStatus(10, 10)).toBe('blocked')
    expect(getUsageStatus(999, null)).toBe('normal')
  })

  it('calculates trial days without returning a negative value', () => {
    expect(
      getTrialDaysRemaining('2026-08-05T00:00:00.000Z', new Date('2026-08-02T00:00:00.000Z')),
    ).toBe(3)
    expect(
      getTrialDaysRemaining('2026-08-01T00:00:00.000Z', new Date('2026-08-02T00:00:00.000Z')),
    ).toBe(0)
  })
})
