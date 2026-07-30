import { describe, expect, it } from 'vitest'
import {
  autoMapGoogleSheetHeaders,
  mapGoogleSheetRow,
  validateGoogleSheetMapping,
} from './google-sheet-mapping'

describe('Google Sheet column mapping', () => {
  it('detects common Arabic and English headers', () => {
    const mapping = autoMapGoogleSheetHeaders([
      'رقم الطلب',
      'اسم العميل',
      'phone',
      'اسم المنتج',
      'السعر',
    ])

    expect(mapping).toMatchObject({
      orderId: 0,
      customerName: 1,
      phone: 2,
      product: 3,
      price: 4,
    })
    expect(validateGoogleSheetMapping(mapping)).toEqual([])
  })

  it('reports missing required fields', () => {
    expect(validateGoogleSheetMapping({ phone: 0 })).toEqual(['اسم العميل', 'اسم المنتج'])
  })

  it('maps a row and supplies safe defaults', () => {
    const row = mapGoogleSheetRow(['فهد', '0550000000', 'حذاء'], {
      customerName: 0,
      phone: 1,
      product: 2,
    })

    expect(row.customerName).toBe('فهد')
    expect(row.quantity).toBe(1)
    expect(row.status).toBe('قيد المعالجة')
  })
})
