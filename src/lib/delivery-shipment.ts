import type { Order } from './types'
import { getOrderTotal } from './order-record'
import { TEST_DELIVERY_CARRIER } from './delivery-simulator'

export const DELIVERY_CARRIERS = [
  TEST_DELIVERY_CARRIER,
  'Yalidine',
  'ZR Express',
  'Maystro Delivery',
  'Guepex',
  'Nord et Ouest Express',
  'شركة أخرى',
] as const

export interface DeliveryShipmentAssignment {
  id: string
  batchId: string
  batchReference: string
  carrier: string
  orderId: string
  sourceOrderId: string
  sheetRow: number | null
  trackingNumber: string
  status: 'ready' | 'in_transit' | 'delivered' | 'exception'
  createdAt: string
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export function buildShipmentCsv(
  items: Array<{ order: Order; shipment?: DeliveryShipmentAssignment }>,
) {
  const headers = [
    'مرجع الدفعة',
    'شركة التوصيل',
    'رقم التتبع',
    'رقم الطلب',
    'العميل',
    'الهاتف',
    'الولاية',
    'البلدية',
    'العنوان',
    'المنتج',
    'الكمية',
    'نوع التوصيل',
    'المبلغ',
  ]
  const rows = items.map(({ order, shipment }) => [
    shipment?.batchReference || '',
    shipment?.carrier || '',
    shipment?.trackingNumber || '',
    order.order_id,
    order.customerName,
    order.phone,
    order.wilaya,
    order.baladiya,
    order.address,
    order.product,
    order.quantity || 1,
    order.deliveryType,
    getOrderTotal(order),
  ])

  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`
}
