/**
 * Sheet Mapping Layer
 *
 * This module is the SINGLE BOUNDARY between Arabic Google Sheets column names
 * and the English domain model. Arabic strings MUST NOT leak past this file.
 */

// ---------------------------------------------------------------------------
// Column name constants — Arabic sheet headers
// ---------------------------------------------------------------------------

export const COL = {
  NAME: 'الاسم',
  PHONE: 'الهاتف',
  WILAYA: 'الولاية',
  BALADIYA: 'البلدية',
  ADDRESS: 'العنوان',
  NOTES: 'الملاحظات',
  PRODUCT: 'المنتج',
  COLOR: 'اللون',
  SIZE: 'المقاس',
  PRICE: 'السعر',
  QUANTITY: 'الكمية',
  DELIVERY_TYPE: 'نوع التوصيل',
  DATE: 'التاريخ',
  STATUS: 'الحالة',
} as const

import type { Order } from './types'

export type SheetColumnName = (typeof COL)[keyof typeof COL]

/** Ordered list matching the Google Sheet column layout */
export const SHEET_COLUMNS: SheetColumnName[] = [
  COL.NAME,
  COL.PHONE,
  COL.WILAYA,
  COL.BALADIYA,
  COL.ADDRESS,
  COL.NOTES,
  COL.PRODUCT,
  COL.COLOR,
  COL.SIZE,
  COL.PRICE,
  COL.QUANTITY,
  COL.DELIVERY_TYPE,
  COL.DATE,
  COL.STATUS,
]

// ---------------------------------------------------------------------------
// Status constants — canonical Arabic status values
// ---------------------------------------------------------------------------

export const STATUS = {
  PREPARING: 'جاري التجهيز',
  PROCESSING: 'قيد المعالجة',
  CONFIRMED: 'مؤكد',
  SHIPPED: 'مشحون',
  DELIVERED: 'تم التسليم',
  NO_ANSWER: 'ما جاوبش',
  CANCELLED: 'ملغي',
} as const

export type OrderStatus = (typeof STATUS)[keyof typeof STATUS]

export const ALL_STATUSES: OrderStatus[] = Object.values(STATUS)

// ---------------------------------------------------------------------------
// Raw row → Domain model
// ---------------------------------------------------------------------------

export interface RawSheetRow extends Record<string, unknown> {
  _row?: number
}

/**
 * Maps a raw Google Sheets row (Arabic keys) to a domain Order (English keys).
 * This is the ONLY place where Arabic column names are read from raw data.
 */
export function mapRawRowToOrder(row: RawSheetRow) {
  return {
    _row: (row._row as number) ?? 0,
    customerName: String(row[COL.NAME] ?? ''),
    phone: String(row[COL.PHONE] ?? ''),
    wilaya: String(row[COL.WILAYA] ?? ''),
    baladiya: String(row[COL.BALADIYA] ?? ''),
    address: String(row[COL.ADDRESS] ?? ''),
    notes: String(row[COL.NOTES] ?? ''),
    product: String(row[COL.PRODUCT] ?? ''),
    color: String(row[COL.COLOR] ?? ''),
    size: String(row[COL.SIZE] ?? ''),
    price: String(row[COL.PRICE] ?? ''),
    quantity: String(row[COL.QUANTITY] ?? ''),
    deliveryType: String(row[COL.DELIVERY_TYPE] ?? ''),
    date: String(row[COL.DATE] ?? ''),
    status: String(row[COL.STATUS] || STATUS.PROCESSING),
  }
}

// ---------------------------------------------------------------------------
// Domain model → Update payload (Arabic keys for Apps Script)
// ---------------------------------------------------------------------------

/**
 * Converts an update object with English keys to Arabic keys for the Apps Script proxy.
 * Only includes fields that are present in the input.
 */
export function toSheetUpdates(updates: Record<string, unknown>): Record<string, unknown> {
  const KEY_MAP: Record<string, SheetColumnName> = {
    customerName: COL.NAME,
    phone: COL.PHONE,
    wilaya: COL.WILAYA,
    baladiya: COL.BALADIYA,
    address: COL.ADDRESS,
    notes: COL.NOTES,
    product: COL.PRODUCT,
    color: COL.COLOR,
    size: COL.SIZE,
    price: COL.PRICE,
    quantity: COL.QUANTITY,
    deliveryType: COL.DELIVERY_TYPE,
    date: COL.DATE,
    status: COL.STATUS,
  }

  const sheetUpdates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(updates)) {
    const sheetKey = KEY_MAP[key]
    if (sheetKey) {
      sheetUpdates[sheetKey] = value
    }
  }
  return sheetUpdates
}

/**
 * Maps a domain Order back to an export-friendly object with Arabic keys.
 * Used for XLSX/CSV export.
 */
export function toExportRow(order: Order) {
  return {
    [COL.NAME]: order.customerName,
    [COL.PHONE]: order.phone,
    [COL.WILAYA]: order.wilaya,
    [COL.BALADIYA]: order.baladiya,
    [COL.ADDRESS]: order.address,
    [COL.NOTES]: order.notes,
    [COL.PRODUCT]: order.product,
    [COL.COLOR]: order.color,
    [COL.SIZE]: order.size,
    [COL.PRICE]: order.price,
    [COL.QUANTITY]: order.quantity,
    [COL.DELIVERY_TYPE]: order.deliveryType,
    [COL.DATE]: order.date,
    [COL.STATUS]: order.status,
  }
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const STATUS_MAP: Record<string, { label: string; color: string; cssVar: string }> = {
  [STATUS.PREPARING]: {
    label: STATUS.PREPARING,
    color: 'bg-[var(--status-processing)]',
    cssVar: '--status-processing',
  },
  [STATUS.PROCESSING]: {
    label: STATUS.PROCESSING,
    color: 'bg-[var(--status-processing)]',
    cssVar: '--status-processing',
  },
  [STATUS.CONFIRMED]: {
    label: STATUS.CONFIRMED,
    color: 'bg-[var(--status-confirmed)]',
    cssVar: '--status-confirmed',
  },
  [STATUS.SHIPPED]: {
    label: STATUS.SHIPPED,
    color: 'bg-[var(--status-shipped)]',
    cssVar: '--status-shipped',
  },
  [STATUS.DELIVERED]: {
    label: STATUS.DELIVERED,
    color: 'bg-[var(--status-delivered)]',
    cssVar: '--status-delivered',
  },
  [STATUS.NO_ANSWER]: {
    label: STATUS.NO_ANSWER,
    color: 'bg-[var(--status-no-answer)]',
    cssVar: '--status-no-answer',
  },
  [STATUS.CANCELLED]: {
    label: STATUS.CANCELLED,
    color: 'bg-[var(--status-cancelled)]',
    cssVar: '--status-cancelled',
  },
}
