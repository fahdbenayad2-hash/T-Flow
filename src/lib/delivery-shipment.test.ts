import { describe, expect, it } from 'vitest'
import { buildShipmentCsv } from './delivery-shipment'
import { STATUS } from './sheet-mapping'
import type { Order } from './types'

const order: Order = {
  _row: 2,
  order_id: 'TF-1',
  customerName: 'عميل، تجريبي',
  phone: '0550000000',
  wilaya: 'الجزائر',
  baladiya: 'باب الزوار',
  address: 'حي "النصر"',
  notes: '',
  product: 'منتج',
  color: '',
  size: '',
  price: 3200,
  quantity: 1,
  deliveryType: 'منزل',
  date: '2026-08-02',
  status: STATUS.CONFIRMED,
}

describe('delivery shipment export', () => {
  it('exports carrier and tracking data as Excel-friendly CSV', () => {
    const csv = buildShipmentCsv([
      {
        order,
        shipment: {
          id: 'shipment-1',
          batchId: 'batch-1',
          batchReference: 'TFB-20260802-TEST',
          carrier: 'Yalidine',
          orderId: 'order-1',
          sourceOrderId: 'TF-1',
          sheetRow: 2,
          trackingNumber: 'TF-TF-1',
          status: 'ready',
          createdAt: '2026-08-02T00:00:00.000Z',
        },
      },
    ])

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"Yalidine"')
    expect(csv).toContain('"TF-TF-1"')
    expect(csv).toContain('"حي ""النصر"""')
  })
})
