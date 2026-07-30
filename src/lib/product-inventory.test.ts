import { describe, expect, it } from 'vitest'
import { aggregateProductInventory, type InventorySetting } from './product-inventory'
import { STATUS } from './sheet-mapping'
import type { Order } from './types'

function order(overrides: Partial<Order> = {}): Order {
  return {
    _row: 2,
    order_id: 'TF-1',
    customerName: 'عميل',
    phone: '0550000000',
    wilaya: 'الجزائر',
    baladiya: '',
    address: '',
    notes: '',
    product: 'حذاء',
    color: 'أسود',
    size: '42',
    price: 3000,
    quantity: 1,
    deliveryType: 'منزل',
    date: '2026-07-30',
    status: STATUS.PROCESSING,
    ...overrides,
  }
}

function setting(overrides: Partial<InventorySetting> = {}): InventorySetting {
  return {
    productName: 'حذاء',
    stockQuantity: 10,
    lowStockThreshold: 3,
    unitCost: 1200,
    updatedAt: '2026-07-30T12:00:00.000Z',
    ...overrides,
  }
}

describe('product inventory', () => {
  it('subtracts reserved units from current stock', () => {
    const [product] = aggregateProductInventory(
      [
        order({ status: STATUS.CONFIRMED, quantity: 2 }),
        order({ _row: 3, order_id: 'TF-2', status: STATUS.DELIVERED }),
      ],
      [setting()],
    )

    expect(product).toMatchObject({
      stockQuantity: 10,
      reservedUnits: 2,
      deliveredUnits: 1,
      availableUnits: 8,
      inventoryValue: 9600,
      health: 'healthy',
    })
  })

  it('raises a low stock warning at the configured threshold', () => {
    const [product] = aggregateProductInventory(
      [order({ status: STATUS.CONFIRMED, quantity: 7 })],
      [setting()],
    )

    expect(product).toMatchObject({ availableUnits: 3, health: 'low' })
  })

  it('keeps products without stock settings visible as untracked', () => {
    const [product] = aggregateProductInventory([order()], [])
    expect(product).toMatchObject({ stockQuantity: null, health: 'untracked' })
  })

  it('includes configured products that have no orders yet', () => {
    const [product] = aggregateProductInventory([], [setting({ productName: 'قميص' })])
    expect(product).toMatchObject({ name: 'قميص', totalOrders: 0, availableUnits: 10 })
  })
})
