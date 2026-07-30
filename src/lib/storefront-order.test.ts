import { describe, expect, it } from 'vitest'
import { STATUS } from './sheet-mapping'
import { normalizeStorefrontOrder } from './storefront-order'

describe('storefront order normalization', () => {
  it('accepts common aliases and nested order payloads', () => {
    const result = normalizeStorefrontOrder(
      {
        order: {
          id: 42,
          name: 'فاطمة',
          mobile: '0550123456',
          province: 'وهران',
          city: 'السانية',
          item_name: 'عباية',
          total_price: '3.500',
          qty: 2,
          createdAt: '20‏/7‏/2026، 12:05:22 م',
          status: STATUS.CONFIRMED,
        },
      },
      new Date('2026-07-30T10:00:00.000Z'),
    )

    expect(result.errors).toEqual([])
    expect(result.order).toMatchObject({
      externalOrderId: '42',
      customerName: 'فاطمة',
      phone: '0550123456',
      wilaya: 'وهران',
      baladiya: 'السانية',
      product: 'عباية',
      price: 3500,
      quantity: 2,
      status: STATUS.CONFIRMED,
      orderedAt: '2026-07-20T11:05:22.000Z',
    })
  })

  it('returns Arabic validation errors for missing required fields', () => {
    const result = normalizeStorefrontOrder({ price: 2000 })

    expect(result.order).toBeUndefined()
    expect(result.errors).toEqual(['رقم الهاتف مطلوب', 'اسم المنتج مطلوب', 'اسم العميل مطلوب'])
  })

  it('falls back to a deterministic id and processing status', () => {
    const payload = {
      customer_name: 'أحمد',
      phone: '0660000000',
      product: 'حذاء',
      date: '2026-07-30',
      status: 'unknown',
    }
    const first = normalizeStorefrontOrder(payload)
    const second = normalizeStorefrontOrder(payload)

    expect(first.order?.externalOrderId).toBe(second.order?.externalOrderId)
    expect(first.order?.status).toBe(STATUS.PROCESSING)
  })
})
