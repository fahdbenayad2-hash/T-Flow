import { describe, expect, it } from 'vitest'
import type { InventorySetting } from './product-inventory'
import { buildProfitabilityInsights } from './profitability-insights'
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
    quantity: 2,
    deliveryType: 'home',
    date: '2026-08-02',
    status: STATUS.DELIVERED,
    ...overrides,
  }
}

function setting(productName: string, unitCost: number): InventorySetting {
  return {
    productName,
    unitCost,
    stockQuantity: 10,
    lowStockThreshold: 2,
    updatedAt: '2026-08-02T00:00:00.000Z',
  }
}

describe('profitability insights', () => {
  it('calculates product cost and gross profit from delivered orders only', () => {
    const result = buildProfitabilityInsights(
      [
        order(),
        order({ _row: 3, status: STATUS.CANCELLED, price: 9000 }),
        order({ _row: 4, order_id: 'TF-2', price: 3000, quantity: 1 }),
      ],
      [setting('منتج أ', 1000)],
    )

    expect(result.totalRevenue).toBe(8000)
    expect(result.knownProductCost).toBe(3000)
    expect(result.grossProfit).toBe(5000)
    expect(result.grossMargin).toBe(63)
    expect(result.costCoverage).toBe(100)
    expect(result.isProfitComplete).toBe(true)
  })

  it('keeps incomplete product profit unknown instead of overstating it', () => {
    const result = buildProfitabilityInsights(
      [order(), order({ _row: 3, order_id: 'TF-2', product: 'منتج ب', price: 4000 })],
      [setting('  منتج أ  ', 1000)],
    )

    expect(result.totalRevenue).toBe(9000)
    expect(result.costedRevenue).toBe(5000)
    expect(result.grossProfit).toBe(3000)
    expect(result.costCoverage).toBe(50)
    expect(result.uncostedOrders).toBe(1)
    expect(result.isProfitComplete).toBe(false)
    expect(result.productEntries.find((item) => item.name === 'منتج ب')?.grossProfit).toBeNull()
  })

  it('treats a saved zero unit cost as configured', () => {
    const result = buildProfitabilityInsights([order()], [setting('منتج أ', 0)])

    expect(result.costCoverage).toBe(100)
    expect(result.knownProductCost).toBe(0)
    expect(result.grossProfit).toBe(5000)
  })
})
