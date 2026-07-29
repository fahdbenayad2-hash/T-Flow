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
  listSupabaseOrders,
  softDeleteSupabaseOrder,
  updateSupabaseOrder,
} from './order-repository'
import { appsScriptUrl, fetchSheetOrders, scriptHeaders } from './sheet-orders'

let cache: {
  data: Order[]
  fetchedAt: number
  mode: OrderStorageMode
} | null = null
const CACHE_TTL = ORDER_CACHE_TTL_S * 1000

async function requireRole(allowedRoles: AppRole[]): Promise<string> {
  const userId = await requireUser()
  if (DEMO_MODE) return userId
  const roles = await fetchUserRoles({ data: userId })
  const hasRole = allowedRoles.some((r) => roles.includes(r))
  if (!hasRole) throw new Error('FORBIDDEN')
  return userId
}

export const getOrders = createServerFn({ method: 'GET' }).handler(async () => {
  const userId = await requireUser()
  const mode = getOrderStorageMode()

  if (cache && cache.mode === mode && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return { orders: cache.data, fromCache: true }
  }

  try {
    const orders = mode === 'supabase' ? await listSupabaseOrders(userId) : await fetchSheetOrders()
    const fetchedAt = Date.now()
    cache = { data: orders, fetchedAt, mode }

    return { orders, fromCache: false }
  } catch (error) {
    console.error('Failed to fetch orders:', error)
    if (cache) {
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
            await supabase.from('audit_log').insert({
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
        const orderId =
          data.order_id ||
          generateOrderId(
            String(data.updates.phone || ''),
            String(data.updates.date || ''),
            String(data.updates.product || ''),
          )
        await supabase.from('audit_log').insert({
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
            await supabase.from('audit_log').insert(
              data.updates.map((item) => ({
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
        const entries = data.updates.map((u) => ({
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
        await supabase.from('audit_log').insert({
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

export const getAuditLog = createServerFn({ method: 'GET' })
  .validator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    await requireUser()

    if (DEMO_MODE) return []

    const supabase = getSupabaseAdminClient()
    const { data: logs, error } = await supabase
      .from('audit_log')
      .select('*')
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
