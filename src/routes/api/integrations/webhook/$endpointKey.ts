import { createFileRoute } from '@tanstack/react-router'
import { normalizeStorefrontOrder } from '~/lib/storefront-order'
import { hashWebhookSecret } from '~/server/store-connections'
import { clearOrdersMemoryCache } from '~/server/orders'
import { getSupabaseAdminClient } from '~/utils/supabase-server'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-TFlow-Secret, X-TFlow-Test',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders })
}

async function secretsMatch(provided: string, expectedHash: string) {
  const providedHash = await hashWebhookSecret(provided)
  if (providedHash.length !== expectedHash.length) return false
  let difference = 0
  for (let index = 0; index < providedHash.length; index += 1) {
    difference |= providedHash.charCodeAt(index) ^ expectedHash.charCodeAt(index)
  }
  return difference === 0
}

async function recordResult(
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

export const Route = createFileRoute('/api/integrations/webhook/$endpointKey')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ params }) => {
        const supabase = getSupabaseAdminClient()
        const { data } = await supabase
          .from('store_integrations')
          .select('is_active,config')
          .eq('provider', 'webhook')
          .eq('external_account_id', params.endpointKey)
          .maybeSingle()

        if (!data) return json({ ok: false, error: 'ENDPOINT_NOT_FOUND' }, 404)
        return json({
          ok: true,
          active: data.is_active,
          name: (data.config as { name?: string } | null)?.name || 'T-Flow Webhook',
        })
      },
      POST: async ({ request, params }) => {
        const contentLength = Number(request.headers.get('content-length') || 0)
        if (contentLength > 65_536) return json({ ok: false, error: 'PAYLOAD_TOO_LARGE' }, 413)

        const supabase = getSupabaseAdminClient()
        const { data: integration, error: integrationError } = await supabase
          .from('store_integrations')
          .select('id,store_id,secret_hash,is_active')
          .eq('provider', 'webhook')
          .eq('external_account_id', params.endpointKey)
          .maybeSingle()

        if (integrationError) return json({ ok: false, error: 'DATABASE_ERROR' }, 500)
        if (!integration) return json({ ok: false, error: 'ENDPOINT_NOT_FOUND' }, 404)
        if (!integration.is_active) return json({ ok: false, error: 'ENDPOINT_DISABLED' }, 403)

        const authorization = request.headers.get('authorization') || ''
        const suppliedSecret =
          request.headers.get('x-tflow-secret') ||
          (authorization.startsWith('Bearer ') ? authorization.slice(7) : '')
        if (
          !suppliedSecret ||
          !integration.secret_hash ||
          !(await secretsMatch(suppliedSecret, integration.secret_hash))
        ) {
          return json({ ok: false, error: 'INVALID_SECRET' }, 401)
        }

        let payload: unknown
        try {
          const payloadText = await request.text()
          if (payloadText.length > 65_536) {
            return json({ ok: false, error: 'PAYLOAD_TOO_LARGE' }, 413)
          }
          payload = JSON.parse(payloadText)
        } catch {
          await recordResult(integration.id, {
            store_id: integration.store_id,
            status: 'rejected',
            error_message: 'INVALID_JSON',
          })
          return json({ ok: false, error: 'INVALID_JSON' }, 400)
        }

        const normalized = normalizeStorefrontOrder(payload)
        if (!normalized.order) {
          await recordResult(integration.id, {
            store_id: integration.store_id,
            status: 'rejected',
            request_summary: { validationErrors: normalized.errors },
            error_message: 'VALIDATION_ERROR',
          })
          return json({ ok: false, error: 'VALIDATION_ERROR', details: normalized.errors }, 422)
        }

        const order = normalized.order
        if (request.headers.get('x-tflow-test') === '1') {
          return json({
            ok: true,
            test: true,
            normalized: {
              orderId: order.displayOrderId,
              customerName: order.customerName,
              phone: order.phone,
              product: order.product,
              total: order.price * order.quantity,
            },
          })
        }

        const sourceOrderId = `${params.endpointKey}:${order.externalOrderId}`
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
            integrationKey: params.endpointKey,
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
          await recordResult(integration.id, {
            store_id: integration.store_id,
            external_order_id: order.externalOrderId,
            status: 'duplicate',
            request_summary: summary,
          })
          return json({
            ok: true,
            duplicate: true,
            orderId: order.displayOrderId,
          })
        }
        if (insertError) {
          await recordResult(integration.id, {
            store_id: integration.store_id,
            external_order_id: order.externalOrderId,
            status: 'rejected',
            request_summary: summary,
            error_message: insertError.message,
          })
          return json({ ok: false, error: 'ORDER_INSERT_FAILED' }, 500)
        }

        await recordResult(integration.id, {
          store_id: integration.store_id,
          external_order_id: order.externalOrderId,
          status: 'accepted',
          order_uuid: created.id,
          request_summary: summary,
        })
        clearOrdersMemoryCache()

        return json(
          {
            ok: true,
            duplicate: false,
            orderId: order.displayOrderId,
          },
          201,
        )
      },
    },
  },
})
