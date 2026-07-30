import { STATUS } from './sheet-mapping'

export const GOOGLE_SHEET_FIELDS = [
  { key: 'orderId', label: 'رقم الطلب', required: false },
  { key: 'customerName', label: 'اسم العميل', required: true },
  { key: 'phone', label: 'رقم الهاتف', required: true },
  { key: 'wilaya', label: 'الولاية', required: false },
  { key: 'baladiya', label: 'البلدية', required: false },
  { key: 'address', label: 'العنوان', required: false },
  { key: 'notes', label: 'الملاحظات', required: false },
  { key: 'product', label: 'اسم المنتج', required: true },
  { key: 'color', label: 'اللون', required: false },
  { key: 'size', label: 'المقاس', required: false },
  { key: 'price', label: 'السعر', required: false },
  { key: 'quantity', label: 'الكمية', required: false },
  { key: 'deliveryType', label: 'نوع التوصيل', required: false },
  { key: 'date', label: 'التاريخ', required: false },
  { key: 'status', label: 'الحالة', required: false },
] as const

export type GoogleSheetFieldKey = (typeof GOOGLE_SHEET_FIELDS)[number]['key']
export type GoogleSheetColumnMapping = Partial<Record<GoogleSheetFieldKey, number>>

const FIELD_ALIASES: Record<GoogleSheetFieldKey, string[]> = {
  orderId: ['رقم الطلب', 'رقم_الطلب', 'order id', 'order_id', 'reference', 'id'],
  customerName: ['الاسم', 'اسم العميل', 'العميل', 'customer name', 'customer_name', 'name'],
  phone: ['الهاتف', 'رقم الهاتف', 'telephone', 'phone number', 'phone', 'mobile'],
  wilaya: ['الولاية', 'wilaya', 'state', 'province'],
  baladiya: ['البلدية', 'المدينة', 'baladiya', 'commune', 'city'],
  address: ['العنوان', 'عنوان التوصيل', 'address', 'shipping address'],
  notes: ['الملاحظات', 'ملاحظة', 'notes', 'note', 'comment'],
  product: ['المنتج', 'اسم المنتج', 'product', 'product name', 'item'],
  color: ['اللون', 'color', 'colour'],
  size: ['المقاس', 'الحجم', 'size'],
  price: ['السعر', 'المبلغ', 'price', 'amount', 'total'],
  quantity: ['الكمية', 'quantity', 'qty'],
  deliveryType: ['نوع التوصيل', 'التوصيل', 'delivery type', 'delivery_type', 'shipping type'],
  date: ['التاريخ', 'تاريخ الطلب', 'date', 'order date', 'created at', 'created_at'],
  status: ['الحالة', 'حالة الطلب', 'status', 'order status'],
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ar')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function autoMapGoogleSheetHeaders(headers: string[]): GoogleSheetColumnMapping {
  const normalizedHeaders = headers.map(normalizeHeader)
  const result: GoogleSheetColumnMapping = {}

  for (const field of GOOGLE_SHEET_FIELDS) {
    const aliases = FIELD_ALIASES[field.key].map(normalizeHeader)
    const index = normalizedHeaders.findIndex((header) => aliases.includes(header))
    if (index >= 0) result[field.key] = index
  }

  return result
}

export function validateGoogleSheetMapping(mapping: GoogleSheetColumnMapping) {
  return GOOGLE_SHEET_FIELDS.filter(
    (field) => field.required && !Number.isInteger(mapping[field.key]),
  ).map((field) => field.label)
}

export function mapGoogleSheetRow(
  row: unknown[],
  mapping: GoogleSheetColumnMapping,
): Record<GoogleSheetFieldKey, unknown> {
  const result = {} as Record<GoogleSheetFieldKey, unknown>
  for (const field of GOOGLE_SHEET_FIELDS) {
    const index = mapping[field.key]
    result[field.key] = Number.isInteger(index) ? (row[index as number] ?? '') : ''
  }
  if (!String(result.status || '').trim()) result.status = STATUS.PROCESSING
  if (!String(result.quantity || '').trim()) result.quantity = 1
  return result
}
