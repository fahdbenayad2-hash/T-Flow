import { normalizeStorefrontOrder } from '~/lib/storefront-order'
import { getSupabaseAdminClient } from '~/utils/supabase-server'
import { clearOrdersMemoryCache } from './orders'

interface StorefrontIntegration {
  id: string
  store_id: string
}

export interface StorefrontIngestionResult {
  body: Record<string, unknown>
  status: number
}

export async function recordStorefrontResult(
  integrationId: string,
  event: {
    store_id: string
    external_order_id?: string | null
    status: 'accepted' | 'duplicate' | 'rejected'
    order_uuid?: string | null
    request_summary?: Record<string, unknown>
    error_message?: string | null
  },
) {
  const supabase = getSupabaseAdminClient()
  await Promise.all([
    supabase.from('webhook_events').insert({
      integration_id: integrationId,
      ...event,
    }),
    supabase.rpc('record_webhook_result', {
      target_integration_id: integrationId,
      result_is_error: event.status === 'rejected',
    }),
  ])
}

export async function ingestStorefrontOrder({
  integration,
  endpointKey,
  payload,
  testOnly = false,
}: {
  integration: StorefrontIntegration
  endpointKey: string
  payload: unknown
  testOnly?: boolean
}): Promise<StorefrontIngestionResult> {
  const normalized = normalizeStorefrontOrder(payload)
  if (!normalized.order) {
    await recordStorefrontResult(integration.id, {
      store_id: integration.store_id,
      status: 'rejected',
      request_summary: { validationErrors: normalized.errors },
      error_message: 'VALIDATION_ERROR',
    })
    return {
      body: { ok: false, error: 'VALIDATION_ERROR', details: normalized.errors },
      status: 422,
    }
  }

  const order = normalized.order
  if (testOnly) {
    return {
      body: {
        ok: true,
        test: true,
        normalized: {
          orderId: order.displayOrderId,
          customerName: order.customerName,
          phone: order.phone,
          product: order.product,
          total: order.price * order.quantity,
        },
      },
      status: 200,
    }
  }

  const supabase = getSupabaseAdminClient()
  const sourceOrderId = `${endpointKey}:${order.externalOrderId}`
  const orderRow = {
    store_id: integration.store_id,
    source: 'webhook',
    source_order_id: sourceOrderId,
    sheet_row: null,
    customer_name: order.customerName,
    phone: order.phone,
    wilaya: order.wilaya,
    baladiya: order.baladiya,
    address: order.address,
    notes: order.notes,
    product: order.product,
    color: order.color,
    size: order.size,
    price: order.price,
    quantity: order.quantity,
    delivery_type: order.deliveryType,
    ordered_at: order.orderedAt,
    ordered_at_text: order.orderedAtText,
    status: order.status,
    raw_data: {
      displayOrderId: order.displayOrderId,
      integrationKey: endpointKey,
      receivedPayload: order.rawPayload,
    },
    last_synced_at: new Date().toISOString(),
  }
  const summary = {
    orderId: order.displayOrderId,
    customerName: order.customerName,
    phone: order.phone,
    product: order.product,
  }
  const { data: created, error: insertError } = await supabase
    .from('orders')
    .insert(orderRow)
    .select('id')
    .single()

  if (insertError?.code === '23505') {
    await recordStorefrontResult(integration.id, {
      store_id: integration.store_id,
      external_order_id: order.externalOrderId,
      status: 'duplicate',
      request_summary: summary,
    })
    return {
      body: { ok: true, duplicate: true, orderId: order.displayOrderId },
      status: 200,
    }
  }

  if (insertError) {
    await recordStorefrontResult(integration.id, {
      store_id: integration.store_id,
      external_order_id: order.externalOrderId,
      status: 'rejected',
      request_summary: summary,
      error_message: insertError.message,
    })
    return { body: { ok: false, error: 'ORDER_INSERT_FAILED' }, status: 500 }
  }

  await recordStorefrontResult(integration.id, {
    store_id: integration.store_id,
    external_order_id: order.externalOrderId,
    status: 'accepted',
    order_uuid: created.id,
    request_summary: summary,
  })
  clearOrdersMemoryCache()

  return {
    body: { ok: true, duplicate: false, orderId: order.displayOrderId },
    status: 201,
  }
}
