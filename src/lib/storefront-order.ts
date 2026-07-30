import { parseOrderDate, parseOrderPrice, parseOrderQuantity } from './order-record'
import { ALL_STATUSES, STATUS } from './sheet-mapping'
import { generateOrderId } from './utils'

export interface NormalizedStorefrontOrder {
  externalOrderId: string
  displayOrderId: string
  customerName: string
  phone: string
  wilaya: string
  baladiya: string
  address: string
  notes: string
  product: string
  color: string
  size: string
  price: number
  quantity: number
  deliveryType: string
  orderedAt: string
  orderedAtText: string
  status: string
  rawPayload: Record<string, unknown>
}

const FIELD_ALIASES = {
  externalOrderId: ['order_id', 'orderId', 'id', 'reference', 'order_number'],
  customerName: ['customer_name', 'customerName', 'name', 'full_name', 'fullname'],
  phone: ['phone', 'phone_number', 'telephone', 'mobile'],
  wilaya: ['wilaya', 'state', 'province'],
  baladiya: ['baladiya', 'city', 'commune', 'municipality'],
  address: ['address', 'shipping_address', 'street'],
  notes: ['notes', 'note', 'comment'],
  product: ['product', 'product_name', 'item', 'item_name'],
  color: ['color', 'colour'],
  size: ['size', 'variant_size'],
  price: ['price', 'total', 'amount', 'total_price'],
  quantity: ['quantity', 'qty'],
  deliveryType: ['delivery_type', 'deliveryType', 'shipping_type', 'shippingType'],
  date: ['date', 'created_at', 'createdAt', 'order_date'],
  status: ['status', 'order_status'],
} as const

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function unwrapPayload(payload: unknown) {
  const root = asRecord(payload)
  const nested = asRecord(root.order)
  const data = asRecord(root.data)
  return Object.keys(nested).length ? nested : Object.keys(data).length ? data : root
}

function pick(record: Record<string, unknown>, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = record[alias]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return ''
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

export function normalizeStorefrontOrder(
  payload: unknown,
  now = new Date(),
): { order?: NormalizedStorefrontOrder; errors: string[] } {
  const record = unwrapPayload(payload)
  const customerName = cleanText(pick(record, FIELD_ALIASES.customerName))
  const phone = cleanText(pick(record, FIELD_ALIASES.phone))
  const product = cleanText(pick(record, FIELD_ALIASES.product))
  const dateText = cleanText(pick(record, FIELD_ALIASES.date)) || now.toISOString()
  const suppliedExternalId = cleanText(pick(record, FIELD_ALIASES.externalOrderId))
  const generatedId = generateOrderId(phone, dateText, product)
  const externalOrderId = suppliedExternalId || generatedId
  const suppliedStatus = cleanText(pick(record, FIELD_ALIASES.status))
  const status = ALL_STATUSES.includes(suppliedStatus as (typeof ALL_STATUSES)[number])
    ? suppliedStatus
    : STATUS.PROCESSING

  const errors: string[] = []
  if (!phone) errors.push('رقم الهاتف مطلوب')
  if (!product) errors.push('اسم المنتج مطلوب')
  if (!customerName) errors.push('اسم العميل مطلوب')
  if (errors.length) return { errors }

  return {
    errors,
    order: {
      externalOrderId,
      displayOrderId: suppliedExternalId || generatedId,
      customerName,
      phone,
      wilaya: cleanText(pick(record, FIELD_ALIASES.wilaya)),
      baladiya: cleanText(pick(record, FIELD_ALIASES.baladiya)),
      address: cleanText(pick(record, FIELD_ALIASES.address)),
      notes: cleanText(pick(record, FIELD_ALIASES.notes)),
      product,
      color: cleanText(pick(record, FIELD_ALIASES.color)),
      size: cleanText(pick(record, FIELD_ALIASES.size)),
      price: parseOrderPrice(pick(record, FIELD_ALIASES.price)),
      quantity: Math.max(parseOrderQuantity(pick(record, FIELD_ALIASES.quantity)), 1),
      deliveryType: cleanText(pick(record, FIELD_ALIASES.deliveryType)),
      orderedAt: parseOrderDate(dateText) || now.toISOString(),
      orderedAtText: dateText,
      status,
      rawPayload: record,
    },
  }
}

export const STOREFRONT_SAMPLE_ORDER = {
  order_id: 'STORE-1001',
  customer_name: 'عميل تجريبي',
  phone: '0550000000',
  wilaya: 'الجزائر',
  baladiya: 'باب الزوار',
  address: 'حي 5 جويلية',
  product: 'اسم المنتج',
  color: 'أسود',
  size: 'M',
  price: 3500,
  quantity: 1,
  delivery_type: 'home',
  notes: 'طلب تجريبي من الموقع',
}
