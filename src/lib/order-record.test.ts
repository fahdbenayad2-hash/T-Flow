import { describe, expect, it } from 'vitest'
import {
  databaseRowToOrder,
  orderToDatabaseInsert,
  parseOrderDate,
  parseOrderPrice,
  parseOrderQuantity,
  toDatabaseOrderUpdates,
  type DatabaseOrderRow,
} from './order-record'
import type { Order } from './types'
import { getOrderStorageMode } from '~/config'

const order: Order = {
  _row: 7,
  order_id: 'FS-TEST01',
  customerName: 'Fahd',
  phone: '0555123456',
  wilaya: 'Alger',
  baladiya: 'Bab El Oued',
  address: 'Rue 1',
  notes: 'Call first',
  product: 'Pyjama',
  color: 'Black',
  size: 'L',
  price: '3.600',
  quantity: '2',
  deliveryType: 'home',
  date: '29/07/2026 14:30:00',
  status: 'قيد المعالجة',
  lastModified: 123,
}

describe('order database mapping', () => {
  it('keeps Sheets as the safe default storage mode', () => {
    expect(getOrderStorageMode(undefined)).toBe('sheets')
    expect(getOrderStorageMode('invalid')).toBe('sheets')
    expect(getOrderStorageMode('shadow')).toBe('shadow')
    expect(getOrderStorageMode('supabase')).toBe('supabase')
  })

  it('normalizes Algerian formatted prices', () => {
    expect(parseOrderPrice('3.600 دج')).toBe(3600)
    expect(parseOrderPrice('12,500')).toBe(12500)
    expect(parseOrderPrice('99.50')).toBe(99.5)
  })

  it('normalizes quantities and rejects invalid values', () => {
    expect(parseOrderQuantity('3 pieces')).toBe(3)
    expect(parseOrderQuantity('-2')).toBe(1)
    expect(parseOrderQuantity('')).toBe(1)
  })

  it('preserves date text while parsing common sheet dates', () => {
    expect(parseOrderDate('29/07/2026 14:30:00')).toBe('2026-07-29T13:30:00.000Z')
    expect(parseOrderDate('20‏/7‏/2026، 12:05:22 م')).toBe('2026-07-20T11:05:22.000Z')
    expect(parseOrderDate('٢٠/٧/٢٠٢٦، ١٢:٠٥:٢٢ ص')).toBe('2026-07-19T23:05:22.000Z')
    expect(parseOrderDate('not a date')).toBeNull()
  })

  it('maps a sheet order to an upsert-safe database record', () => {
    const row = orderToDatabaseInsert(order, 'store-1')
    expect(row).toMatchObject({
      store_id: 'store-1',
      source: 'google_sheets',
      source_order_id: 'FS-TEST01',
      sheet_row: 7,
      customer_name: 'Fahd',
      price: 3600,
      quantity: 2,
      ordered_at_text: '29/07/2026 14:30:00',
    })
    expect(row.raw_data).toMatchObject({ displayOrderId: 'FS-TEST01' })
  })

  it('keeps the display ID when a duplicate needs a unique source key', () => {
    const row = orderToDatabaseInsert(order, 'store-1', 'FS-TEST01:sheet-row:7')
    expect(row.source_order_id).toBe('FS-TEST01:sheet-row:7')
    expect(row.raw_data).toMatchObject({ displayOrderId: 'FS-TEST01' })
  })

  it('maps database rows back to the existing UI model', () => {
    const row: DatabaseOrderRow = {
      id: 'db-order-1',
      store_id: 'store-1',
      source: 'google_sheets',
      source_order_id: 'FS-TEST01',
      sheet_row: 7,
      customer_name: 'Fahd',
      phone: '0555123456',
      wilaya: 'Alger',
      baladiya: 'Bab El Oued',
      address: 'Rue 1',
      notes: '',
      product: 'Pyjama',
      color: 'Black',
      size: 'L',
      price: 3600,
      quantity: 2,
      delivery_type: 'home',
      ordered_at: '2026-07-29T13:30:00.000Z',
      ordered_at_text: '29/07/2026 14:30:00',
      status: 'قيد المعالجة',
      raw_data: {},
      version: 1,
      last_synced_at: '2026-07-29T13:31:00.000Z',
      created_at: '2026-07-29T13:31:00.000Z',
      updated_at: '2026-07-29T13:31:00.000Z',
      deleted_at: null,
    }

    expect(databaseRowToOrder(row)).toMatchObject({
      _row: 7,
      order_id: 'FS-TEST01',
      customerName: 'Fahd',
      price: 3600,
      quantity: 2,
    })
  })

  it('allows only known order fields in database updates', () => {
    expect(
      toDatabaseOrderUpdates({
        status: 'تم التسليم',
        price: '4.200',
        unknown: 'ignored',
      }),
    ).toEqual({
      status: 'تم التسليم',
      price: 4200,
    })
  })
})
