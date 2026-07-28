import { createServerFn } from '@tanstack/react-start'
import { DEMO_MODE_SERVER as DEMO_MODE, ORDER_CACHE_TTL_S, APPS_SCRIPT_SECRET } from '~/config'
import { getSupabaseAdminClient } from '~/utils/supabase-server'
import { mapRawRowToOrder, toSheetUpdates } from '~/lib/sheet-mapping'
import type { Order } from '~/lib/types'
import type { AppRole } from '~/lib/types'
import { generateOrderId } from '~/lib/utils'
import { requireUser, fetchUserRoles, requireAdmin } from './auth'

function appsScriptUrl(): string {
  const url = process.env.APPS_SCRIPT_URL
  if (!url) throw new Error('Missing APPS_SCRIPT_URL environment variable')
  const separator = url.includes('?') ? '&' : '?'
  const secretParam = APPS_SCRIPT_SECRET ? `${separator}secret=${encodeURIComponent(APPS_SCRIPT_SECRET)}` : ''
  return url + secretParam
}

function scriptHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (APPS_SCRIPT_SECRET) h['X-TFlow-Secret'] = APPS_SCRIPT_SECRET
  return h
}

let cache: { data: Order[]; fetchedAt: number } | null = null
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
  await requireUser()

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return { orders: cache.data, fromCache: true }
  }

  try {
    const res = await fetch(appsScriptUrl(), {
      method: 'GET',
      headers: scriptHeaders(),
    })

    if (!res.ok) {
      // If 403 from GAS, the secret is wrong — surface a clear message
      if (res.status === 403) {
        throw new Error('Apps Script authentication failed — check APPS_SCRIPT_SECRET')
      }
      throw new Error(`Apps Script responded with ${res.status}`)
    }

    const json = await res.json()

    const raw: Array<Record<string, unknown>> = Array.isArray(json) ? json : json.orders || []

    if (!Array.isArray(json) && !json.orders) {
      throw new Error('Unexpected Apps Script response format')
    }

    const fetchedAt = Date.now()
    const orders: Order[] = raw.map((row) => {
      const mapped = mapRawRowToOrder(row)
      return {
        ...mapped,
        order_id: generateOrderId(mapped.phone, mapped.date, mapped.product),
        lastModified: fetchedAt,
      }
    })

    cache = { data: orders, fetchedAt }

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
    await requireRole(['admin', 'shipping_manager', 'confirmation_agent'])

    // Limit confirmation_agent to notes-only updates
    const roles = DEMO_MODE
      ? (['admin'] as AppRole[])
      : await fetchUserRoles({ data: await requireUser() })
    if (roles.includes('confirmation_agent')) {
      const allowedKeys = ['notes', 'status']
      const updateKeys = Object.keys(data.updates)
      const invalidKeys = updateKeys.filter((k) => !allowedKeys.includes(k))
      if (invalidKeys.length > 0) {
        throw new Error('FORBIDDEN')
      }
    }

    if (data.lastModified && cache && cache.fetchedAt > data.lastModified) {
      return {
        ok: false as const,
        error: {
          code: 'STALE_DATA',
          message: 'البيانات لم تعد محدثة، يرجى تحديث الصفحة ثم إعادة المحاولة',
        },
      }
    }

    const sheetUpdates = toSheetUpdates(data.updates)

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
    await requireRole(['admin', 'shipping_manager'])

    if (!data.updates.length) return { ok: true as const, data: { count: 0 } }

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
    (data: {
      row: number
      order_id?: string
      orderData?: Record<string, unknown>
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAdmin()

    // Log the full order data before deletion (for audit trail)
    if (!DEMO_MODE && data.orderData) {
      try {
        const supabase = getSupabaseAdminClient()
        await supabase.from('audit_log').insert({
          order_id: data.order_id || null,
          action: 'delete_order',
          old_value: data.orderData,
          new_value: null,
        })
      } catch (e) {
        console.warn('Audit log failed (non-critical):', e)
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

      if (!response.ok) {
        const text = await response.text().catch(() => '')
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
