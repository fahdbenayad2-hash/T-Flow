import { createFileRoute } from '@tanstack/react-router'
import { isStorefrontOriginAllowed, readLandingPageConfig } from '~/lib/landing-page'
import { ingestStorefrontOrder, recordStorefrontResult } from '~/server/storefront-ingestion'
import { getSupabaseAdminClient } from '~/utils/supabase-server'

const MAX_REQUESTS_PER_MINUTE = 12
const MAX_PAYLOAD_BYTES = 65_536
const MIN_FORM_TIME_MS = 1_000
const MAX_FORM_TIME_MS = 2 * 60 * 60 * 1_000

function corsHeaders(origin?: string | null) {
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
}

function json(body: Record<string, unknown>, status: number, origin?: string | null) {
  return Response.json(body, { status, headers: corsHeaders(origin) })
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function loadPublicIntegration(endpointKey: string) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('store_integrations')
    .select('id,store_id,is_active,config')
    .eq('provider', 'webhook')
    .eq('external_account_id', endpointKey)
    .maybeSingle()

  return { supabase, integration: data, error }
}

export const Route = createFileRoute('/api/integrations/public/$endpointKey')({
  server: {
    handlers: {
      OPTIONS: async ({ request, params }) => {
        const origin = request.headers.get('origin')
        const { integration } = await loadPublicIntegration(params.endpointKey)
        const landingPage = readLandingPageConfig(integration?.config)

        if (
          !integration?.is_active ||
          !landingPage.enabled ||
          !isStorefrontOriginAllowed(origin, landingPage.allowedOrigin)
        ) {
          return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403)
        }

        return new Response(null, { status: 204, headers: corsHeaders(origin) })
      },
      GET: async ({ request, params }) => {
        const origin = request.headers.get('origin')
        const { integration, error } = await loadPublicIntegration(params.endpointKey)
        if (error) return json({ ok: false, error: 'DATABASE_ERROR' }, 500)
        if (!integration) return json({ ok: false, error: 'ENDPOINT_NOT_FOUND' }, 404)

        const landingPage = readLandingPageConfig(integration.config)
        const allowed = isStorefrontOriginAllowed(origin, landingPage.allowedOrigin)
        return json(
          {
            ok: true,
            active: integration.is_active && landingPage.enabled,
            originAllowed: allowed,
          },
          200,
          allowed ? origin : null,
        )
      },
      POST: async ({ request, params }) => {
        const contentLength = Number(request.headers.get('content-length') || 0)
        if (contentLength > MAX_PAYLOAD_BYTES) {
          return json({ ok: false, error: 'PAYLOAD_TOO_LARGE' }, 413)
        }

        const origin = request.headers.get('origin')
        const { supabase, integration, error } = await loadPublicIntegration(params.endpointKey)
        if (error) return json({ ok: false, error: 'DATABASE_ERROR' }, 500)
        if (!integration) return json({ ok: false, error: 'ENDPOINT_NOT_FOUND' }, 404)

        const landingPage = readLandingPageConfig(integration.config)
        const originAllowed = isStorefrontOriginAllowed(origin, landingPage.allowedOrigin)
        if (!originAllowed) return json({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403)
        if (!integration.is_active || !landingPage.enabled) {
          return json({ ok: false, error: 'ENDPOINT_DISABLED' }, 403, origin)
        }

        let payload: unknown
        try {
          const text = await request.text()
          if (text.length > MAX_PAYLOAD_BYTES) {
            return json({ ok: false, error: 'PAYLOAD_TOO_LARGE' }, 413, origin)
          }
          payload = JSON.parse(text)
        } catch {
          await recordStorefrontResult(integration.id, {
            store_id: integration.store_id,
            status: 'rejected',
            error_message: 'INVALID_JSON',
          })
          return json({ ok: false, error: 'INVALID_JSON' }, 400, origin)
        }

        const record = asRecord(payload)
        if (String(record._tf_website || '').trim()) {
          return json({ ok: true }, 202, origin)
        }

        const startedAt = Number(record._tf_started_at)
        const formTime = Date.now() - startedAt
        if (
          !Number.isFinite(startedAt) ||
          formTime < MIN_FORM_TIME_MS ||
          formTime > MAX_FORM_TIME_MS
        ) {
          return json({ ok: false, error: 'FORM_CHECK_FAILED' }, 400, origin)
        }

        const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
        const { count, error: rateError } = await supabase
          .from('webhook_events')
          .select('id', { count: 'exact', head: true })
          .eq('integration_id', integration.id)
          .gte('created_at', oneMinuteAgo)

        if (rateError) return json({ ok: false, error: 'DATABASE_ERROR' }, 500, origin)
        if ((count || 0) >= MAX_REQUESTS_PER_MINUTE) {
          return json({ ok: false, error: 'RATE_LIMITED' }, 429, origin)
        }

        const result = await ingestStorefrontOrder({
          integration,
          endpointKey: params.endpointKey,
          payload,
        })
        return json(result.body, result.status, origin)
      },
    },
  },
})
