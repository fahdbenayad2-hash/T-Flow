import { createServerFn } from '@tanstack/react-start'
import type { Order } from '~/lib/types'
import { generateOrderId } from '~/lib/utils'

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL!
const DEMO_MODE = !process.env.APP_SUPABASE_URL || process.env.APP_SUPABASE_URL === 'https://your-project-ref.supabase.co'

let cache: { data: Order[]; fetchedAt: number } | null = null
const CACHE_TTL = 45_000

export const getOrders = createServerFn({ method: 'GET' }).handler(async () => {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return { orders: cache.data, fromCache: true }
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      throw new Error(`Apps Script responded with ${res.status}`)
    }

    const raw: Array<Record<string, unknown>> = await res.json()

    const orders: Order[] = raw.map((row) => ({
      _row: row._row as number,
      order_id: generateOrderId(
        row['الهاتف'],
        row['التاريخ'] as string,
        row['المنتج'] as string
      ),
      'الاسم': (row['الاسم'] as string) || '',
      'الهاتف': row['الهاتف'] || '',
      'الولاية': row['الولاية'] || '',
      'البلدية': (row['البلدية'] as string) || '',
      'العنوان': (row['العنوان'] as string) || '',
      'الملاحظات': (row['الملاحظات'] as string) || '',
      'المنتج': (row['المنتج'] as string) || '',
      'اللون': (row['اللون'] as string) || '',
      'المقاس': (row['المقاس'] as string) || '',
      'السعر': row['السعر'] || '',
      'الكمية': row['الكمية'] || '',
      'نوع التوصيل': (row['نوع التوصيل'] as string) || '',
      'التاريخ': (row['التاريخ'] as string) || '',
      'الحالة': (row['الحالة'] as string) || 'قيد المعالجة',
    }))

    cache = { data: orders, fetchedAt: Date.now() }

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
  .validator((data: { row: number; updates: Record<string, unknown>; lastModified?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _row: data.row,
          updates: data.updates,
        }),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        if (response.status === 429 || text.includes('quota') || text.includes('Quota')) {
          return { ok: false as const, error: { code: 'QUOTA_EXCEEDED', message: 'تم تجاوز حد الطلبات في Google Sheets، حاول مرة أخرى بعد دقائق' } }
        }
        return { ok: false as const, error: { code: 'PROXY_ERROR', message: `فشل الاتصال بالخادوم (${response.status})` } }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'خطأ غير معروف'
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('timeout')) {
        return { ok: false as const, error: { code: 'NETWORK_ERROR', message: 'خطأ في الاتصال بالخادوم، تحقق من اتصالك وأعد المحاولة' } }
      }
      return { ok: false as const, error: { code: 'UNKNOWN', message: `خطأ غير متوقع: ${msg}` } }
    }

    if (!DEMO_MODE) {
      try {
        const { getSupabaseServerClient } = await import('~/utils/supabase-server')
        const supabase = getSupabaseServerClient()
        const orderId = generateOrderId(
          data.updates['الهاتف'] || '',
          data.updates['التاريخ'] || '',
          data.updates['المنتج'] || ''
        )
        await supabase.from('audit_log').insert({
          order_id: orderId,
          action: 'update_order',
          old_value: data.lastModified ? { lastModified: data.lastModified } : null,
          new_value: data.updates,
        })
      } catch (e) {
        console.warn('Audit log failed (non-critical):', e)
      }
    }

    cache = null

    return { ok: true as const, data: { success: true } }
  })

export const getAuditLog = createServerFn({ method: 'GET' })
  .validator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    if (DEMO_MODE) {
      return []
    }

    const { getSupabaseServerClient } = await import('~/utils/supabase-server')
    const supabase = getSupabaseServerClient()

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
  cache = null
  return { success: true }
})
