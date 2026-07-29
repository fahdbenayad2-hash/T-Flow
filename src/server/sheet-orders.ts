import { APPS_SCRIPT_SECRET } from '~/config'
import { mapRawRowToOrder } from '~/lib/sheet-mapping'
import type { Order } from '~/lib/types'
import { generateOrderId } from '~/lib/utils'

export function appsScriptUrl(): string {
  const url = process.env.APPS_SCRIPT_URL
  if (!url) throw new Error('Missing APPS_SCRIPT_URL environment variable')
  const separator = url.includes('?') ? '&' : '?'
  const secretParam = APPS_SCRIPT_SECRET
    ? `${separator}secret=${encodeURIComponent(APPS_SCRIPT_SECRET)}`
    : ''
  return url + secretParam
}

export function scriptHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (APPS_SCRIPT_SECRET) headers['X-TFlow-Secret'] = APPS_SCRIPT_SECRET
  return headers
}

export async function fetchSheetOrders(): Promise<Order[]> {
  const response = await fetch(appsScriptUrl(), {
    method: 'GET',
    headers: scriptHeaders(),
  })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Apps Script authentication failed — check APPS_SCRIPT_SECRET')
    }
    throw new Error(`Apps Script responded with ${response.status}`)
  }

  const json = await response.json()
  const raw: Array<Record<string, unknown>> = Array.isArray(json) ? json : json.orders || []

  if (!Array.isArray(json) && !json.orders) {
    throw new Error('Unexpected Apps Script response format')
  }

  const fetchedAt = Date.now()
  const ghostRows: Array<{ _row: number; date: string; status: string }> = []
  const orders = raw
    .map((row) => {
      const mapped = mapRawRowToOrder(row)
      return {
        ...mapped,
        order_id: generateOrderId(mapped.phone, mapped.date, mapped.product),
        lastModified: fetchedAt,
      } satisfies Order
    })
    .filter((order) => {
      const isGhost = !String(order.phone || '').trim() && !String(order.product || '').trim()
      if (isGhost) {
        ghostRows.push({
          _row: order._row,
          date: order.date,
          status: order.status,
        })
      }
      return !isGhost
    })

  if (ghostRows.length > 0) {
    console.warn(`[T-Flow] Filtered out ${ghostRows.length} ghost rows`, ghostRows)
  }

  return orders
}

export interface AppsScriptResult {
  ok?: boolean
  success?: boolean
  error?: string
  message?: string
  results?: Array<{ row?: number; error?: string }>
}

/**
 * Google Apps Script ContentService always responds with HTTP 200 for JSON
 * application errors. Treat an explicit `{ ok: false }` body as a failed write.
 */
export async function postSheetMutation(body: Record<string, unknown>): Promise<AppsScriptResult> {
  if (APPS_SCRIPT_SECRET) body._secret = APPS_SCRIPT_SECRET

  const response = await fetch(appsScriptUrl(), {
    method: 'POST',
    headers: scriptHeaders(),
    body: JSON.stringify(body),
  })
  const text = await response.text().catch(() => '')
  let result: AppsScriptResult = {}

  if (text) {
    try {
      result = JSON.parse(text) as AppsScriptResult
    } catch {
      result = { message: text }
    }
  }

  if (!response.ok) {
    const error = new Error(result.message || result.error || `HTTP_${response.status}`)
    Object.assign(error, { status: response.status, responseText: text })
    throw error
  }

  if (result.ok === false) {
    throw new Error(result.error || result.message || 'Apps Script rejected the mutation')
  }

  return result
}
