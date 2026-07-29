import type { Order } from './types'
import { generateOrderId } from './utils'

export interface DatabaseOrderRow {
  id: string
  store_id: string
  source: string
  source_order_id: string
  sheet_row: number | null
  customer_name: string
  phone: string
  wilaya: string
  baladiya: string
  address: string
  notes: string
  product: string
  color: string
  size: string
  price: number | string
  quantity: number | string
  delivery_type: string
  ordered_at: string | null
  ordered_at_text: string
  status: string
  raw_data: Record<string, unknown> | null
  version: number
  last_synced_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type DatabaseOrderInsert = Omit<
  DatabaseOrderRow,
  'id' | 'version' | 'created_at' | 'updated_at'
>

function cleanNumericText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '')
}

export function parseOrderPrice(value: unknown): number {
  const text = cleanNumericText(value)
  if (!text) return 0

  // Algerian UI commonly formats thousands as 3.000 or 3,000.
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(text)) {
    return Number(text.replace(/[.,]/g, '')) || 0
  }

  const normalized =
    text.includes(',') && !text.includes('.') ? text.replace(',', '.') : text.replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function parseOrderQuantity(value: unknown): number {
  const parsed = Number.parseInt(cleanNumericText(value), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1
}

/**
 * Dates coming from Sheets are locale-formatted. We keep the original text and
 * only populate ordered_at when parsing is unambiguous enough.
 */
export function parseOrderDate(value: unknown): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null

  const isoTimestamp = Date.parse(text)
  if (/^\d{4}-\d{2}-\d{2}/.test(text) && Number.isFinite(isoTimestamp)) {
    return new Date(isoTimestamp).toISOString()
  }

  const match = text.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  )
  if (!match) return null

  const [, day, month, year, hour = '0', minute = '0', second = '0'] = match
  const utc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 1, // Africa/Algiers is UTC+1
    Number(minute),
    Number(second),
  )
  const parsed = new Date(utc)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function orderToDatabaseInsert(
  order: Order,
  storeId: string,
  sourceOrderIdOverride?: string,
): DatabaseOrderInsert {
  const displayOrderId = order.order_id || generateOrderId(order.phone, order.date, order.product)
  const sourceOrderId = sourceOrderIdOverride || displayOrderId

  return {
    store_id: storeId,
    source: 'google_sheets',
    source_order_id: sourceOrderId,
    sheet_row: order._row >= 2 ? order._row : null,
    customer_name: String(order.customerName ?? ''),
    phone: String(order.phone ?? ''),
    wilaya: String(order.wilaya ?? ''),
    baladiya: String(order.baladiya ?? ''),
    address: String(order.address ?? ''),
    notes: String(order.notes ?? ''),
    product: String(order.product ?? ''),
    color: String(order.color ?? ''),
    size: String(order.size ?? ''),
    price: parseOrderPrice(order.price),
    quantity: parseOrderQuantity(order.quantity),
    delivery_type: String(order.deliveryType ?? ''),
    ordered_at: parseOrderDate(order.date),
    ordered_at_text: String(order.date ?? ''),
    status: String(order.status ?? ''),
    raw_data: {
      importedFrom: 'google_sheets',
      displayOrderId,
    },
    last_synced_at: new Date().toISOString(),
    deleted_at: null,
  }
}

export function databaseRowToOrder(row: DatabaseOrderRow): Order {
  const displayOrderId =
    typeof row.raw_data?.displayOrderId === 'string'
      ? row.raw_data.displayOrderId
      : row.source_order_id

  return {
    _row: row.sheet_row ?? 0,
    order_id: displayOrderId,
    customerName: row.customer_name,
    phone: row.phone,
    wilaya: row.wilaya,
    baladiya: row.baladiya,
    address: row.address,
    notes: row.notes,
    product: row.product,
    color: row.color,
    size: row.size,
    price: Number(row.price),
    quantity: Number(row.quantity),
    deliveryType: row.delivery_type,
    date: row.ordered_at_text || row.ordered_at || '',
    status: row.status,
    lastModified: Date.parse(row.updated_at),
  }
}

const UPDATE_COLUMN_MAP: Record<string, string> = {
  customerName: 'customer_name',
  phone: 'phone',
  wilaya: 'wilaya',
  baladiya: 'baladiya',
  address: 'address',
  notes: 'notes',
  product: 'product',
  color: 'color',
  size: 'size',
  price: 'price',
  quantity: 'quantity',
  deliveryType: 'delivery_type',
  date: 'ordered_at_text',
  status: 'status',
}

export function toDatabaseOrderUpdates(updates: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(updates)) {
    const column = UPDATE_COLUMN_MAP[key]
    if (!column) continue

    if (key === 'price') result[column] = parseOrderPrice(value)
    else if (key === 'quantity') result[column] = parseOrderQuantity(value)
    else result[column] = String(value ?? '')

    if (key === 'date') result.ordered_at = parseOrderDate(value)
  }

  return result
}
