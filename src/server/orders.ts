import { createServerFn } from '@tanstack/react-start'
import {
  DEMO_MODE_SERVER as DEMO_MODE,
  ORDER_CACHE_TTL_S,
  APPS_SCRIPT_SECRET,
  getOrderStorageMode,
  type OrderStorageMode,
} from '~/config'
import { getSupabaseAdminClient } from '~/utils/supabase-server'
import { toSheetUpdates } from '~/lib/sheet-mapping'
import type { Order } from '~/lib/types'
import type { AppRole } from '~/lib/types'
import { generateOrderId } from '~/lib/utils'
import { requireUser, fetchUserRoles, requireAdmin } from './auth'
import {
  batchUpdateSupabaseOrders,
  importOrdersToSupabase,
  ingestNewSheetOrdersToSupabase,
  listSupabaseOrders,
  resolveDefaultStoreId,
  softDeleteSupabaseOrder,
  updateSupabaseOrder,
} from './order-repository'
import { appsScriptUrl, fetchSheetOrders, scriptHeaders } from './sheet-orders'

let cache: {
  data: Order[]
  fetchedAt: number
  mode: OrderStorageMode
  userId: string
} | null = null
const CACHE_TTL = ORDER_CACHE_TTL_S * 1000
const LEGACY_STORE_SLUG = process.env.DEFAULT_STORE_SLUG || 'main'

export function clearOrdersMemoryCache() {
  cache = null
}

async function requireSuccessfulSheetMirror(response: Response, operation: string): Promise<void> {
  const responseBody = await response
    .clone()
    .json()
    .catch(() => ({}))

  if (!response.ok || responseBody.ok === false) {
    throw new Error(
      responseBody.error ||
        responseBody.message ||
        `${operation} failed with status ${response.status}`,
    )
  }
}

async function mirrorOrderUpdateToSheet(data: {
  row: number
  updates: Record<string, unknown>
  phone?: string
  product?: string
}): Promise<void> {
  const body: Record<string, unknown> = {
    _row: data.row,
    updates: toSheetUpdates(data.updates),
  }
  if (APPS_SCRIPT_SECRET) body._secret = APPS_SCRIPT_SECRET
  if (data.phone) body._phone = data.phone
  if (data.product) body._product = data.product

  const response = await fetch(appsScriptUrl(), {
    method: 'POST',
    headers: scriptHeaders(),
    body: JSON.stringify(body),
  })
  await requireSuccessfulSheetMirror(response, 'Sheet backup update')
}

async function mirrorBatchUpdateToSheet(
  updates: Array<{
    row: number
    updates: Record<string, unknown>
    phone?: string
    product?: string
  }>,
): Promise<void> {
  const body: Record<string, unknown> = {
    batch: updates.map((item) => ({
      _row: item.row,
      updates: toSheetUpdates(item.updates),
      _phone: item.phone,
      _product: item.product,
    })),
  }
  if (APPS_SCRIPT_SECRET) body._secret = APPS_SCRIPT_SECRET

  const response = await fetch(appsScriptUrl(), {
    method: 'POST',
    headers: scriptHeaders(),
    body: JSON.stringify(body),
  })
  await requireSuccessfulSheetMirror(response, 'Sheet backup batch update')
}

async function mirrorOrderDeleteToSheet(row: number): Promise<void> {
  const body: Record<string, unknown> = { _delete: true, _row: row }
  if (APPS_SCRIPT_SECRET) body._secret = APPS_SCRIPT_SECRET

  const response = await fetch(appsScriptUrl(), {
    method: 'POST',
    headers: scriptHeaders(),
    body: JSON.stringify(body),
  })
  await requireSuccessfulSheetMirror(response, 'Sheet backup delete')
}

async function requireRole(allowedRoles: AppRole[]): Promise<string> {
  const userId = await requireUser()
  if (DEMO_MODE) return userId
  const roles = await fetchUserRoles({ data: userId })
  const hasRole = allowedRoles.some((r) => roles.includes(r))
  if (!hasRole) throw new Error('FORBIDDEN')
  return userId
}

async function shouldMirrorLegacySheet(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)
  const { data, error } = await supabase.from('stores').select('slug').eq('id', storeId).single()
  if (error) throw error
  return data.slug === LEGACY_STORE_SLUG
}

export const getOrders = createServerFn({ method: 'GET' }).handler(async () => {
  const userId = await requireUser()
  const mode = getOrderStorageMode()

  if (
    cache &&
    cache.userId === userId &&
    cache.mode === mode &&
    Date.now() - cache.fetchedAt < CACHE_TTL
  ) {
    return { orders: cache.data, fromCache: true }
  }

  try {
    let orders: Order[]

    if (mode === 'supabase') {
      if (await shouldMirrorLegacySheet(userId)) {
        try {
          const sheetOrders = await fetchSheetOrders()
          await ingestNewSheetOrdersToSupabase(userId, sheetOrders)
        } catch (error) {
          // Sheets remains an inbound bridge for the legacy store only.
          // Existing Supabase orders stay available if that bridge is offline.
          console.warn('Sheet order intake failed (Supabase served):', error)
        }
      }

      orders = await listSupabaseOrders(userId)
    } else {
      orders = await fetchSheetOrders()
    }

    if (mode === 'shadow' && (await shouldMirrorLegacySheet(userId))) {
      try {
        // New orders can be written directly to Google Sheets by an external
        // storefront. Reconcile every fresh sheet snapshot so those inserts,
        // along with out-of-band edits and deletes, reach Supabase too.
        await importOrdersToSupabase(userId, orders)
      } catch (error) {
        // Shadow mode must never make Supabase availability a dependency for
        // the primary Sheets read path.
        console.warn('Supabase shadow reconciliation failed (Sheets served):', error)
      }
    }

    const fetchedAt = Date.now()
    cache = { data: orders, fetchedAt, mode, userId }

    return { orders, fromCache: false }
  } catch (error) {
    console.error('Failed to fetch orders:', error)
    if (cache?.userId === userId) {
      return { orders: cache.data, fromCache: true, stale: true }
    }
    throw error
  }
})

export const updateOrder = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      row: number
      updates: Record<string, unknown>
      lastModified?: number
      order_id?: string
      phone?: string
      product?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    // admin + shipping_manager can update status; confirmation_agent limited to notes
    const actorUserId = await requireRole(['admin', 'shipping_manager', 'confirmation_agent'])
    const storageMode = getOrderStorageMode()

    // Limit confirmation_agent to notes-only updates
    const roles = DEMO_MODE ? (['admin'] as AppRole[]) : await fetchUserRoles({ data: actorUserId })
    if (roles.includes('confirmation_agent')) {
      const allowedKeys = ['notes', 'status']
      const updateKeys = Object.keys(data.updates)
      const invalidKeys = updateKeys.filter((k) => !allowedKeys.includes(k))
      if (invalidKeys.length > 0) {
        throw new Error('FORBIDDEN')
      }
    }

    if (
      storageMode !== 'supabase' &&
      data.lastModified &&
      cache &&
      cache.userId === actorUserId &&
      cache.fetchedAt > data.lastModified
    ) {
      return {
        ok: false as const,
        error: {
          code: 'STALE_DATA',
          message: 'البيانات لم تعد محدثة، يرجى تحديث الصفحة ثم إعادة المحاولة',
        },
      }
    }

    const sheetUpdates = toSheetUpdates(data.updates)

    if (storageMode === 'supabase') {
      try {
        const result = await updateSupabaseOrder(
          actorUserId,
          { orderId: data.order_id, sheetRow: data.row },
          data.updates,
          data.lastModified,
        )

        if (result.stale) {
          return {
            ok: false as const,
            error: {
              code: 'STALE_DATA',
              message: 'تم تعديل الطلب من مستخدم آخر، حدّث الصفحة ثم أعد المحاولة',
            },
          }
        }

        if (!result.updated) {
          return {
            ok: false as const,
            error: {
              code: 'ORDER_NOT_FOUND',
              message: 'لم يتم العثور على الطلب في قاعدة البيانات',
            },
          }
        }

        if (!DEMO_MODE) {
          try {
            const supabase = getSupabaseAdminClient()
            const storeId = await resolveDefaultStoreId(actorUserId, supabase)
            await supabase.from('audit_log').insert({
              store_id: storeId,
              order_id: result.orderId || data.order_id || null,
              actor_id: actorUserId,
              action: 'update_order',
              old_value: data.lastModified ? { lastModified: data.lastModified } : null,
              new_value: data.updates,
            })
          } catch (error) {
            console.warn('Audit log failed (non-critical):', error)
          }
        }

        if (await shouldMirrorLegacySheet(actorUserId)) {
          try {
            await mirrorOrderUpdateToSheet(data)
          } catch (error) {
            console.warn('Sheet backup update failed (Supabase succeeded):', error)
          }
        }

        cache = null
        return { ok: true as const, data: { success: true } }
      } catch (error) {
        return {
          ok: false as const,
          error: {
            code: 'DATABASE_ERROR',
            message: error instanceof Error ? error.message : 'فشل تحديث الطلب في قاعدة البيانات',
          },
        }
      }
    }

    try {
      const body: Record<string, unknown> = {
        _row: data.row,
        updates: sheetUpdates,
      }
      if (APPS_SCRIPT_SECRET) body._secret = APPS_SCRIPT_SECRET
      if (data.phone) body._phone = data.phone
      if (data.product) body._product = data.product

      const response = await fetch(appsScriptUrl(), {
        method: 'POST',
        headers: scriptHeaders(),
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        // Handle STALE_DATA from GAS (phone/product mismatch)
        if (response.status === 409) {
          const errBody = await response.json().catch(() => ({}))
          return {
            ok: false as const,
            error: {
              code: 'STALE_DATA',
              message: errBody.message || 'البيانات لم تعد محدثة، يرجى تحديث الصفحة',
            },
          }
        }
        const text = await response.text().catch(() => '')
        if (response.status === 429 || text.includes('quota') || text.includes('Quota')) {
          return {
            ok: false as const,
            error: {
              code: 'QUOTA_EXCEEDED',
              message: 'تم تجاوز حد الطلبات في Google Sheets، حاول مرة أخرى بعد دقائق',
            },
          }
        }
        if (response.status === 403) {
          return {
            ok: false as const,
            error: {
              code: 'AUTH_ERROR',
              message: 'فشل التحقق من هوية الخادوم (APPS_SCRIPT_SECRET)',
            },
          }
        }
        return {
          ok: false as const,
          error: { code: 'PROXY_ERROR', message: `فشل الاتصال بالخادوم (${response.status})` },
        }
      }

      const responseBody = await response.json().catch(() => ({}))
      if (responseBody.ok === false) {
        return {
          ok: false as const,
          error: {
            code: 'PROXY_ERROR',
            message: responseBody.error || responseBody.message || 'رفض Apps Script عملية التحديث',
          },
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'خطأ غير معروف'
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('timeout')
      ) {
        return {
          ok: false as const,
          error: {
            code: 'NETWORK_ERROR',
            message: 'خطأ في الاتصال بالخادوم، تحقق من اتصالك وأعد المحاولة',
          },
        }
      }
      return { ok: false as const, error: { code: 'UNKNOWN', message: `خطأ غير متوقع: ${msg}` } }
    }

    if (storageMode === 'shadow') {
      try {
        await updateSupabaseOrder(
          actorUserId,
          { orderId: data.order_id, sheetRow: data.row },
          data.updates,
        )
      } catch (error) {
        console.warn('Supabase shadow update failed (Sheets succeeded):', error)
      }
    }

    if (!DEMO_MODE) {
      try {
        const supabase = getSupabaseAdminClient()
        const storeId = await resolveDefaultStoreId(actorUserId, supabase)
        const orderId =
          data.order_id ||
          generateOrderId(
            String(data.updates.phone || ''),
            String(data.updates.date || ''),
            String(data.updates.product || ''),
          )
        await supabase.from('audit_log').insert({
          store_id: storeId,
          order_id: orderId,
          actor_id: actorUserId,
          action: 'update_order',
          old_value: data.lastModified ? { lastModified: data.lastModified } : null,
          new_value: sheetUpdates,
        })
      } catch (e) {
        console.warn('Audit log failed (non-critical):', e)
      }
    }

    cache = null

    return { ok: true as const, data: { success: true } }
  })

export const batchUpdateOrders = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      updates: Array<{
        row: number
        updates: Record<string, unknown>
        order_id?: string
        phone?: string
        product?: string
      }>
    }) => data,
  )
  .handler(async ({ data }) => {
    // Only admin and shipping_manager can bulk-update
    const actorUserId = await requireRole(['admin', 'shipping_manager'])
    const storageMode = getOrderStorageMode()

    if (!data.updates.length) return { ok: true as const, data: { count: 0 } }

    if (storageMode === 'supabase') {
      try {
        const result = await batchUpdateSupabaseOrders(
          actorUserId,
          data.updates.map((item) => ({
            identifier: {
              orderId: item.order_id,
              sheetRow: item.row,
            },
            updates: item.updates,
          })),
        )
        if (result.missing > 0) {
          return {
            ok: false as const,
            error: {
              code: 'PARTIAL_UPDATE',
              message: `تعذر العثور على ${result.missing} طلب`,
            },
          }
        }

        if (!DEMO_MODE) {
          try {
            const supabase = getSupabaseAdminClient()
            const storeId = await resolveDefaultStoreId(actorUserId, supabase)
            await supabase.from('audit_log').insert(
              data.updates.map((item) => ({
                store_id: storeId,
                order_id: item.order_id || null,
                actor_id: actorUserId,
                action: 'batch_update_order',
                new_value: item.updates,
              })),
            )
          } catch (error) {
            console.warn('Audit log failed (non-critical):', error)
          }
        }

        if (await shouldMirrorLegacySheet(actorUserId)) {
          try {
            await mirrorBatchUpdateToSheet(data.updates)
          } catch (error) {
            console.warn('Sheet backup batch update failed (Supabase succeeded):', error)
          }
        }

        cache = null
        return { ok: true as const, data: { count: result.count } }
      } catch (error) {
        return {
          ok: false as const,
          error: {
            code: 'DATABASE_ERROR',
            message:
              error instanceof Error ? error.message : 'فشل التحديث الجماعي في قاعدة البيانات',
          },
        }
      }
    }

    const sheetUpdates = data.updates.map((u) => ({
      _row: u.row,
      updates: toSheetUpdates(u.updates),
      _phone: u.phone,
      _product: u.product,
    }))

    try {
      const batchBody: Record<string, unknown> = { batch: sheetUpdates }
      if (APPS_SCRIPT_SECRET) batchBody._secret = APPS_SCRIPT_SECRET

      const response = await fetch(appsScriptUrl(), {
        method: 'POST',
        headers: scriptHeaders(),
        body: JSON.stringify(batchBody),
      })

      const batchResponseBody = response.ok
        ? await response
            .clone()
            .json()
            .catch(() => ({}))
        : {}
      if (batchResponseBody.ok === false) {
        return {
          ok: false as const,
          error: {
            code: 'PROXY_ERROR',
            message:
              batchResponseBody.error ||
              batchResponseBody.message ||
              'رفض Apps Script عملية التحديث الجماعي',
          },
        }
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        if (response.status === 429 || text.includes('quota') || text.includes('Quota')) {
          return {
            ok: false as const,
            error: {
              code: 'QUOTA_EXCEEDED',
              message: 'تم تجاوز حد الطلبات في Google Sheets، حاول مرة أخرى بعد دقائق',
            },
          }
        }
        if (response.status === 403) {
          return {
            ok: false as const,
            error: {
              code: 'AUTH_ERROR',
              message: 'فشل التحقق من هوية الخادوم (APPS_SCRIPT_SECRET)',
            },
          }
        }
        return {
          ok: false as const,
          error: { code: 'PROXY_ERROR', message: `فشل الاتصال بالخادوم (${response.status})` },
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'خطأ غير معروف'
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('timeout')
      ) {
        return {
          ok: false as const,
          error: {
            code: 'NETWORK_ERROR',
            message: 'خطأ في الاتصال بالخادوم، تحقق من اتصالك وأعد المحاولة',
          },
        }
      }
      return { ok: false as const, error: { code: 'UNKNOWN', message: `خطأ غير متوقع: ${msg}` } }
    }

    if (storageMode === 'shadow') {
      try {
        await batchUpdateSupabaseOrders(
          actorUserId,
          data.updates.map((item) => ({
            identifier: {
              orderId: item.order_id,
              sheetRow: item.row,
            },
            updates: item.updates,
          })),
        )
      } catch (error) {
        console.warn('Supabase shadow batch update failed (Sheets succeeded):', error)
      }
    }

    if (!DEMO_MODE) {
      try {
        const supabase = getSupabaseAdminClient()
        const storeId = await resolveDefaultStoreId(actorUserId, supabase)
        const entries = data.updates.map((u) => ({
          store_id: storeId,
          order_id:
            u.order_id ||
            generateOrderId(
              String(u.updates.phone || ''),
              String(u.updates.date || ''),
              String(u.updates.product || ''),
            ),
          actor_id: actorUserId,
          action: 'batch_update_order',
          new_value: toSheetUpdates(u.updates),
        }))
        await supabase.from('audit_log').insert(entries)
      } catch (e) {
        console.warn('Audit log failed (non-critical):', e)
      }
    }

    cache = null

    return { ok: true as const, data: { count: data.updates.length } }
  })

export const deleteOrder = createServerFn({ method: 'POST' })
  .validator(
    (data: { row: number; order_id?: string; orderData?: Record<string, unknown> }) => data,
  )
  .handler(async ({ data }) => {
    const actorUserId = await requireAdmin()
    const storageMode = getOrderStorageMode()

    // Log the full order data before deletion (for audit trail)
    if (!DEMO_MODE && data.orderData) {
      try {
        const supabase = getSupabaseAdminClient()
        const storeId = await resolveDefaultStoreId(actorUserId, supabase)
        await supabase.from('audit_log').insert({
          store_id: storeId,
          order_id: data.order_id || null,
          actor_id: actorUserId,
          action: 'delete_order',
          old_value: data.orderData,
          new_value: null,
        })
      } catch (e) {
        console.warn('Audit log failed (non-critical):', e)
      }
    }

    if (storageMode === 'supabase') {
      try {
        const deleted = await softDeleteSupabaseOrder(actorUserId, {
          orderId: data.order_id,
          sheetRow: data.row,
        })
        if (!deleted) {
          return {
            ok: false as const,
            error: {
              code: 'ORDER_NOT_FOUND',
              message: 'لم يتم العثور على الطلب في قاعدة البيانات',
            },
          }
        }

        if (await shouldMirrorLegacySheet(actorUserId)) {
          try {
            await mirrorOrderDeleteToSheet(data.row)
          } catch (error) {
            console.warn('Sheet backup delete failed (Supabase succeeded):', error)
          }
        }

        cache = null
        return { ok: true as const, data: { success: true } }
      } catch (error) {
        return {
          ok: false as const,
          error: {
            code: 'DATABASE_ERROR',
            message: error instanceof Error ? error.message : 'فشل حذف الطلب من قاعدة البيانات',
          },
        }
      }
    }

    try {
      const body: Record<string, unknown> = { _delete: true, _row: data.row }
      if (APPS_SCRIPT_SECRET) body._secret = APPS_SCRIPT_SECRET

      const response = await fetch(appsScriptUrl(), {
        method: 'POST',
        headers: scriptHeaders(),
        body: JSON.stringify(body),
      })

      const deleteResponseBody = response.ok
        ? await response
            .clone()
            .json()
            .catch(() => ({}))
        : {}
      if (deleteResponseBody.ok === false) {
        return {
          ok: false as const,
          error: {
            code: 'PROXY_ERROR',
            message:
              deleteResponseBody.error ||
              deleteResponseBody.message ||
              'رفض Apps Script عملية الحذف',
          },
        }
      }

      if (!response.ok) {
        if (response.status === 403) {
          return {
            ok: false as const,
            error: {
              code: 'AUTH_ERROR',
              message: 'فشل التحقق من هوية الخادوم (APPS_SCRIPT_SECRET)',
            },
          }
        }
        return {
          ok: false as const,
          error: {
            code: 'PROXY_ERROR',
            message: `فشل الاتصال بالخادوم (${response.status})`,
          },
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'خطأ غير معروف'
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('timeout')
      ) {
        return {
          ok: false as const,
          error: {
            code: 'NETWORK_ERROR',
            message: 'خطأ في الاتصال بالخادوم، تحقق من اتصالك وأعد المحاولة',
          },
        }
      }
      return { ok: false as const, error: { code: 'UNKNOWN', message: `خطأ غير متوقع: ${msg}` } }
    }

    if (storageMode === 'shadow') {
      try {
        await softDeleteSupabaseOrder(actorUserId, {
          orderId: data.order_id,
          sheetRow: data.row,
        })
      } catch (error) {
        console.warn('Supabase shadow delete failed (Sheets succeeded):', error)
      }
    }

    // Invalidate cache immediately — row numbers have shifted
    cache = null

    return { ok: true as const, data: { success: true } }
  })

export const batchDeleteOrders = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      orders: Array<{
        row: number
        order_id?: string
        orderData?: Record<string, unknown>
      }>
    }) => data,
  )
  .handler(async ({ data }) => {
    const actorUserId = await requireAdmin()
    const storageMode = getOrderStorageMode()
    const orders = [...data.orders].sort((a, b) => b.row - a.row)

    if (!orders.length) {
      return { ok: true as const, data: { count: 0, missing: 0 } }
    }

    if (!DEMO_MODE) {
      try {
        const supabase = getSupabaseAdminClient()
        const storeId = await resolveDefaultStoreId(actorUserId, supabase)
        await supabase.from('audit_log').insert(
          orders.map((order) => ({
            store_id: storeId,
            order_id: order.order_id || null,
            actor_id: actorUserId,
            action: 'delete_order',
            old_value: order.orderData || null,
            new_value: null,
          })),
        )
      } catch (error) {
        console.warn('Audit log failed (non-critical):', error)
      }
    }

    if (storageMode === 'supabase') {
      try {
        let count = 0
        let missing = 0

        for (const order of orders) {
          const deleted = await softDeleteSupabaseOrder(actorUserId, {
            orderId: order.order_id,
            sheetRow: order.row,
          })
          if (deleted) count += 1
          else missing += 1
        }

        if (await shouldMirrorLegacySheet(actorUserId)) {
          for (const order of orders.filter((item) => item.row >= 2)) {
            try {
              await mirrorOrderDeleteToSheet(order.row)
            } catch (error) {
              console.warn('Sheet backup delete failed (Supabase succeeded):', error)
            }
          }
        }

        cache = null
        return { ok: true as const, data: { count, missing } }
      } catch (error) {
        return {
          ok: false as const,
          error: {
            code: 'DATABASE_ERROR',
            message: error instanceof Error ? error.message : 'فشل حذف الطلبات من قاعدة البيانات',
          },
        }
      }
    }

    try {
      for (const order of orders) {
        await mirrorOrderDeleteToSheet(order.row)
      }
    } catch (error) {
      return {
        ok: false as const,
        error: {
          code: 'PROXY_ERROR',
          message: error instanceof Error ? error.message : 'فشل حذف الطلبات من Google Sheets',
        },
      }
    }

    if (storageMode === 'shadow') {
      for (const order of orders) {
        try {
          await softDeleteSupabaseOrder(actorUserId, {
            orderId: order.order_id,
            sheetRow: order.row,
          })
        } catch (error) {
          console.warn('Supabase shadow delete failed (Sheets succeeded):', error)
        }
      }
    }

    cache = null
    return { ok: true as const, data: { count: orders.length, missing: 0 } }
  })

export const getAuditLog = createServerFn({ method: 'GET' })
  .validator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireUser()

    if (DEMO_MODE) return []

    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const { data: logs, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('store_id', storeId)
      .eq('order_id', data.orderId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return logs || []
  })

export const invalidateOrdersCache = createServerFn({ method: 'POST' }).handler(async () => {
  await requireUser()

  cache = null
  return { success: true }
})
