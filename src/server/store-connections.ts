import { createServerFn } from '@tanstack/react-start'
import { getSupabaseAdminClient } from '~/utils/supabase-server'
import { requireAdmin } from './auth'
import { resolveDefaultStoreId } from './order-repository'

interface StoreConnectionConfig {
  name?: string
  version?: number
}

interface StoreConnectionRow {
  id: string
  store_id: string
  external_account_id: string
  config: StoreConnectionConfig | null
  is_active: boolean
  last_received_at: string | null
  received_count: number | string
  error_count: number | string
  created_at: string
}

export async function hashWebhookSecret(secret: string) {
  const bytes = new TextEncoder().encode(secret)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function generateEndpointKey() {
  return `wh_${randomHex(9)}`
}

function generateWebhookSecret() {
  return `tfwh_${randomHex(24)}`
}

function toConnection(row: StoreConnectionRow) {
  return {
    id: row.id,
    name: row.config?.name || 'موقع الطلبات',
    endpointKey: row.external_account_id,
    endpointPath: `/api/integrations/webhook/${row.external_account_id}`,
    isActive: row.is_active,
    lastReceivedAt: row.last_received_at,
    receivedCount: Number(row.received_count) || 0,
    errorCount: Number(row.error_count) || 0,
    createdAt: row.created_at,
  }
}

export const getStoreConnections = createServerFn({ method: 'GET' }).handler(async () => {
  const userId = await requireAdmin()
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)

  const [{ data: connectionRows, error: connectionError }, { data: eventRows, error: eventError }] =
    await Promise.all([
      supabase
        .from('store_integrations')
        .select(
          'id,store_id,external_account_id,config,is_active,last_received_at,received_count,error_count,created_at',
        )
        .eq('store_id', storeId)
        .eq('provider', 'webhook')
        .order('created_at', { ascending: false }),
      supabase
        .from('webhook_events')
        .select(
          'id,integration_id,external_order_id,status,error_message,request_summary,created_at',
        )
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

  if (connectionError) throw connectionError
  if (eventError) throw eventError

  return {
    connections: ((connectionRows || []) as StoreConnectionRow[]).map(toConnection),
    events: eventRows || [],
  }
})

export const createStoreConnection = createServerFn({ method: 'POST' })
  .validator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireAdmin()
    const name = data.name.trim()
    if (!name) throw new Error('اسم الموقع مطلوب')
    if (name.length > 80) throw new Error('اسم الموقع طويل جدًا')

    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const endpointKey = generateEndpointKey()
    const secret = generateWebhookSecret()
    const { data: created, error } = await supabase
      .from('store_integrations')
      .insert({
        store_id: storeId,
        provider: 'webhook',
        external_account_id: endpointKey,
        config: { name, version: 1 },
        secret_hash: await hashWebhookSecret(secret),
        is_active: true,
      })
      .select(
        'id,store_id,external_account_id,config,is_active,last_received_at,received_count,error_count,created_at',
      )
      .single()

    if (error) throw error

    await supabase.from('audit_log').insert({
      actor_id: userId,
      store_id: storeId,
      action: 'create_store_webhook',
      new_value: { integrationId: created.id, name, endpointKey },
    })

    return { connection: toConnection(created as StoreConnectionRow), secret }
  })

export const rotateStoreConnectionSecret = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireAdmin()
    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const secret = generateWebhookSecret()
    const { data: updated, error } = await supabase
      .from('store_integrations')
      .update({ secret_hash: await hashWebhookSecret(secret) })
      .eq('id', data.id)
      .eq('store_id', storeId)
      .eq('provider', 'webhook')
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!updated) throw new Error('لم يتم العثور على الاتصال')

    await supabase.from('audit_log').insert({
      actor_id: userId,
      store_id: storeId,
      action: 'rotate_store_webhook_secret',
      new_value: { integrationId: data.id },
    })

    return { secret }
  })

export const setStoreConnectionActive = createServerFn({ method: 'POST' })
  .validator((data: { id: string; isActive: boolean }) => data)
  .handler(async ({ data }) => {
    const userId = await requireAdmin()
    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const { data: updated, error } = await supabase
      .from('store_integrations')
      .update({ is_active: data.isActive })
      .eq('id', data.id)
      .eq('store_id', storeId)
      .eq('provider', 'webhook')
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!updated) throw new Error('لم يتم العثور على الاتصال')

    await supabase.from('audit_log').insert({
      actor_id: userId,
      store_id: storeId,
      action: data.isActive ? 'activate_store_webhook' : 'deactivate_store_webhook',
      new_value: { integrationId: data.id },
    })

    return { success: true }
  })
