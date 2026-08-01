import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order } from '~/lib/types'
import {
  databaseRowToOrder,
  orderToDatabaseInsert,
  toDatabaseOrderUpdates,
  type DatabaseOrderInsert,
  type DatabaseOrderRow,
} from '~/lib/order-record'
import { getSupabaseAdminClient } from '~/utils/supabase-server'

const DEFAULT_STORE_SLUG = process.env.DEFAULT_STORE_SLUG || 'main'
const PAGE_SIZE = 1000
const UPSERT_BATCH_SIZE = 250

export interface OrderIdentifier {
  orderId?: string
  sheetRow?: number
}

export interface ImportSummary {
  syncRunId: string
  storeId: string
  scanned: number
  inserted: number
  updated: number
  deleted: number
  skipped: number
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

function prepareSheetOrderRows(
  orders: Order[],
  storeId: string,
): { rows: DatabaseOrderInsert[]; skipped: number } {
  const validOrders = orders.filter(
    (order) =>
      Boolean(String(order.phone || '').trim()) || Boolean(String(order.product || '').trim()),
  )
  const idFrequency = new Map<string, number>()
  for (const order of validOrders) {
    idFrequency.set(order.order_id, (idFrequency.get(order.order_id) || 0) + 1)
  }

  const rows = validOrders.map((order) => {
    const sourceOrderId =
      (idFrequency.get(order.order_id) || 0) > 1
        ? `${order.order_id}:sheet-row:${order._row}`
        : order.order_id
    return orderToDatabaseInsert(order, storeId, sourceOrderId)
  })

  return { rows, skipped: orders.length - validOrders.length }
}

async function loadExistingSourceOrderIds(
  supabase: SupabaseClient,
  storeId: string,
): Promise<Set<string>> {
  const existingIds = new Set<string>()

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: existing, error } = await supabase
      .from('orders')
      .select('source_order_id')
      .eq('store_id', storeId)
      .eq('source', 'google_sheets')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    for (const row of existing || []) existingIds.add(row.source_order_id)
    if (!existing || existing.length < PAGE_SIZE) break
  }

  return existingIds
}

/**
 * Resolves the caller's active store. A seller may own a slug other than
 * `main`, so memberships must never be limited to the legacy default store.
 */
export async function resolveDefaultStoreId(
  userId: string,
  supabase = getSupabaseAdminClient(),
): Promise<string> {
  const { data: memberships, error: membershipError } = await supabase
    .from('store_members')
    .select('store_id,joined_at,stores!inner(slug,is_active)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('stores.is_active', true)
    .order('joined_at', { ascending: true })
    .limit(20)

  if (membershipError) throw membershipError
  if (memberships?.length) {
    const preferred =
      memberships.find((membership) => {
        const store = Array.isArray(membership.stores) ? membership.stores[0] : membership.stores
        return store?.slug === DEFAULT_STORE_SLUG
      }) || memberships[0]
    return preferred.store_id as string
  }

  const { data: roles, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)

  if (roleError) throw roleError
  const userRoles = (roles || []).map((entry) => entry.role)

  if (!userRoles.includes('admin')) {
    throw new Error('STORE_MEMBERSHIP_REQUIRED')
  }

  // Recover legacy owners without ever attaching an unrelated seller to the
  // shared main store.
  const { data: ownedStore, error: storeLookupError } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (storeLookupError) throw storeLookupError

  let storeId = ownedStore?.id as string | undefined
  if (!storeId) {
    const personalSlug = `store-${userId.replaceAll('-', '')}`
    const { data: createdStore, error: createError } = await supabase
      .from('stores')
      .insert({
        owner_id: userId,
        name: 'متجري',
        slug: personalSlug,
      })
      .select('id')
      .single()

    if (createError) {
      const { data: racedStore, error: racedError } = await supabase
        .from('stores')
        .select('id')
        .eq('slug', personalSlug)
        .single()
      if (racedError) throw createError
      storeId = racedStore.id as string
    } else {
      storeId = createdStore.id as string
    }
  }

  const { error: attachError } = await supabase.from('store_members').upsert(
    userRoles.map((role) => ({
      store_id: storeId,
      user_id: userId,
      role,
      is_active: true,
    })),
    {
      onConflict: 'store_id,user_id,role',
      ignoreDuplicates: false,
    },
  )
  if (attachError) throw attachError

  return storeId
}

export async function listSupabaseOrders(userId: string): Promise<Order[]> {
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)
  const rows: DatabaseOrderRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('store_id', storeId)
      .is('deleted_at', null)
      .order('ordered_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('sheet_row', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    rows.push(...((data || []) as DatabaseOrderRow[]))
    if (!data || data.length < PAGE_SIZE) break
  }

  return rows.map(databaseRowToOrder)
}

async function findOrderRow(
  supabase: SupabaseClient,
  storeId: string,
  identifier: OrderIdentifier,
) {
  if (identifier.orderId) {
    const { data, error } = await supabase
      .from('orders')
      .select('id,source_order_id,sheet_row,updated_at,version')
      .eq('store_id', storeId)
      .eq('source_order_id', identifier.orderId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  if (identifier.sheetRow && identifier.sheetRow >= 2) {
    const { data, error } = await supabase
      .from('orders')
      .select('id,source_order_id,sheet_row,updated_at,version')
      .eq('store_id', storeId)
      .eq('sheet_row', identifier.sheetRow)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    return data
  }

  if (!identifier.orderId) throw new Error('ORDER_IDENTIFIER_REQUIRED')
  return null
}

export async function updateSupabaseOrder(
  userId: string,
  identifier: OrderIdentifier,
  updates: Record<string, unknown>,
  expectedLastModified?: number,
): Promise<{ updated: boolean; stale?: boolean; orderId?: string }> {
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)
  const current = await findOrderRow(supabase, storeId, identifier)
  if (!current) return { updated: false }

  const currentModified = Date.parse(current.updated_at)
  if (
    expectedLastModified &&
    Number.isFinite(currentModified) &&
    currentModified > expectedLastModified
  ) {
    return { updated: false, stale: true, orderId: current.source_order_id }
  }

  const databaseUpdates = toDatabaseOrderUpdates(updates)
  if (!Object.keys(databaseUpdates).length) {
    return { updated: true, orderId: current.source_order_id }
  }

  let query = supabase
    .from('orders')
    .update(databaseUpdates)
    .eq('id', current.id)
    .is('deleted_at', null)

  if (expectedLastModified) query = query.eq('updated_at', current.updated_at)

  const { data, error } = await query.select('source_order_id')
  if (error) throw error
  if (!data?.length) {
    return { updated: false, stale: true, orderId: current.source_order_id }
  }

  return { updated: true, orderId: data[0].source_order_id }
}

export async function batchUpdateSupabaseOrders(
  userId: string,
  items: Array<{
    identifier: OrderIdentifier
    updates: Record<string, unknown>
  }>,
): Promise<{ count: number; missing: number }> {
  let count = 0
  let missing = 0

  for (const group of chunks(items, 20)) {
    const results = await Promise.all(
      group.map((item) => updateSupabaseOrder(userId, item.identifier, item.updates)),
    )
    count += results.filter((result) => result.updated).length
    missing += results.filter((result) => !result.updated).length
  }

  return { count, missing }
}

export async function softDeleteSupabaseOrder(
  userId: string,
  identifier: OrderIdentifier,
): Promise<boolean> {
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)
  const current = await findOrderRow(supabase, storeId, identifier)
  if (!current) return false

  const { error } = await supabase
    .from('orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', current.id)
    .is('deleted_at', null)

  if (error) throw error
  return true
}

/**
 * Bridges an external storefront that still writes new orders to Google Sheets
 * after Supabase becomes the operational source of truth. Existing Supabase
 * rows are never updated or deleted here, so dashboard edits cannot be
 * overwritten by a stale Sheet snapshot.
 */
export async function ingestNewSheetOrdersToSupabase(
  userId: string,
  orders: Order[],
): Promise<{ storeId: string; scanned: number; inserted: number; skipped: number }> {
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)
  const { rows, skipped } = prepareSheetOrderRows(orders, storeId)
  const existingIds = await loadExistingSourceOrderIds(supabase, storeId)
  const newRows = rows.filter((row) => !existingIds.has(row.source_order_id))

  for (const group of chunks(newRows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase.from('orders').upsert(group, {
      onConflict: 'store_id,source,source_order_id',
      ignoreDuplicates: true,
    })
    if (error) throw error
  }

  return {
    storeId,
    scanned: orders.length,
    inserted: newRows.length,
    skipped,
  }
}

export async function importOrdersToSupabase(
  userId: string,
  orders: Order[],
): Promise<ImportSummary> {
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)

  const { data: syncRun, error: syncRunError } = await supabase
    .from('order_sync_runs')
    .insert({
      store_id: storeId,
      provider: 'google_sheets',
      direction: 'import',
      status: 'running',
      scanned_count: orders.length,
      started_by: userId,
    })
    .select('id')
    .single()

  if (syncRunError) throw syncRunError

  const { rows, skipped } = prepareSheetOrderRows(orders, storeId)

  try {
    const existingIds = await loadExistingSourceOrderIds(supabase, storeId)

    // Sheet rows shift after deletions. Clear old pointers before assigning the
    // current snapshot so the partial unique index cannot conflict transiently.
    const { error: clearRowsError } = await supabase
      .from('orders')
      .update({ sheet_row: null })
      .eq('store_id', storeId)
      .eq('source', 'google_sheets')
      .is('deleted_at', null)
    if (clearRowsError) throw clearRowsError

    for (const group of chunks(rows, UPSERT_BATCH_SIZE)) {
      const { error: upsertError } = await supabase.from('orders').upsert(group, {
        onConflict: 'store_id,source,source_order_id',
      })
      if (upsertError) throw upsertError
    }

    const currentIds = new Set(rows.map((row) => row.source_order_id))
    const staleIds = [...existingIds].filter((id) => !currentIds.has(id))
    const deletedAt = new Date().toISOString()
    for (const group of chunks(staleIds, UPSERT_BATCH_SIZE)) {
      const { error: deleteError } = await supabase
        .from('orders')
        .update({ deleted_at: deletedAt, sheet_row: null })
        .eq('store_id', storeId)
        .eq('source', 'google_sheets')
        .in('source_order_id', group)
      if (deleteError) throw deleteError
    }

    const updated = rows.filter((row) => existingIds.has(row.source_order_id)).length
    const inserted = rows.length - updated
    const deleted = staleIds.length
    const { error: finishError } = await supabase
      .from('order_sync_runs')
      .update({
        status: 'completed',
        inserted_count: inserted,
        updated_count: updated,
        deleted_count: deleted,
        skipped_count: skipped,
        finished_at: new Date().toISOString(),
      })
      .eq('id', syncRun.id)

    if (finishError) throw finishError

    return {
      syncRunId: syncRun.id,
      storeId,
      scanned: orders.length,
      inserted,
      updated,
      deleted,
      skipped,
    }
  } catch (error) {
    await supabase
      .from('order_sync_runs')
      .update({
        status: 'failed',
        error_count: 1,
        error_summary: [
          {
            message: error instanceof Error ? error.message : 'Unknown import error',
          },
        ],
        finished_at: new Date().toISOString(),
      })
      .eq('id', syncRun.id)
    throw error
  }
}

export async function getOrderMigrationStatus(userId: string) {
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)

  const [{ count, error: countError }, { data: lastRun, error: runError }] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .is('deleted_at', null),
    supabase
      .from('order_sync_runs')
      .select('*')
      .eq('store_id', storeId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (countError) throw countError
  if (runError) throw runError

  return {
    storeId,
    orderCount: count || 0,
    lastRun: lastRun || null,
  }
}
