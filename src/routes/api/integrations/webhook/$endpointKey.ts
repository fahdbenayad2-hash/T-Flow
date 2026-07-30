import { createFileRoute } from '@tanstack/react-router'
import { hashWebhookSecret } from '~/server/store-connections'
import { ingestStorefrontOrder, recordStorefrontResult } from '~/server/storefront-ingestion'
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
          await recordStorefrontResult(integration.id, {
            store_id: integration.store_id,
            status: 'rejected',
            error_message: 'INVALID_JSON',
          })
          return json({ ok: false, error: 'INVALID_JSON' }, 400)
        }

        const result = await ingestStorefrontOrder({
          integration,
          endpointKey: params.endpointKey,
          payload,
          testOnly: request.headers.get('x-tflow-test') === '1',
        })
        return json(result.body, result.status)
      },
    },
  },
})
