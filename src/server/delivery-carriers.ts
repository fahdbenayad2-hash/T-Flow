import { createServerFn } from '@tanstack/react-start'
import { DEMO_MODE_SERVER as DEMO_MODE } from '~/config'
import { getSupabaseAdminClient } from '~/utils/supabase-server'
import { requireAdmin } from './auth'
import { encryptCarrierCredential, decryptCarrierCredential } from './carrier-credentials'
import { resolveDefaultStoreId } from './order-repository'
import { testYalidineCredentials, YALIDINE_BASE_URL } from './yalidine-client'

interface CarrierConnectionRow {
  id: string
  provider: 'yalidine'
  account_label: string
  api_id: string
  api_token_encrypted: string
  base_url: string
  is_active: boolean
  connection_status: 'untested' | 'connected' | 'error'
  last_tested_at: string | null
  last_error: string | null
  updated_at: string
}

export interface DeliveryCarrierConnection {
  id: string
  provider: 'yalidine'
  accountLabel: string
  apiIdMasked: string
  isActive: boolean
  status: 'untested' | 'connected' | 'error'
  lastTestedAt: string | null
  lastError: string | null
  updatedAt: string
}

function maskApiId(value: string) {
  if (value.length <= 6) return `${value.slice(0, 2)}••••`
  return `${value.slice(0, 3)}••••${value.slice(-3)}`
}

function toConnection(row: CarrierConnectionRow): DeliveryCarrierConnection {
  return {
    id: row.id,
    provider: row.provider,
    accountLabel: row.account_label,
    apiIdMasked: maskApiId(row.api_id),
    isActive: row.is_active,
    status: row.connection_status,
    lastTestedAt: row.last_tested_at,
    lastError: row.last_error,
    updatedAt: row.updated_at,
  }
}

async function carrierContext() {
  const userId = await requireAdmin()
  if (DEMO_MODE) return { userId, storeId: 'demo-store', supabase: null }
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)
  return { userId, storeId, supabase }
}

export const getDeliveryCarrierConnection = createServerFn({ method: 'GET' }).handler(async () => {
  const { storeId, supabase } = await carrierContext()
  if (!supabase) return null as DeliveryCarrierConnection | null

  const { data, error } = await supabase
    .from('delivery_carrier_connections')
    .select(
      'id,provider,account_label,api_id,api_token_encrypted,base_url,is_active,connection_status,last_tested_at,last_error,updated_at',
    )
    .eq('store_id', storeId)
    .eq('provider', 'yalidine')
    .maybeSingle()
  if (error) throw error
  return data ? toConnection(data as CarrierConnectionRow) : null
})

export const saveYalidineConnection = createServerFn({ method: 'POST' })
  .validator((data: { accountLabel?: string; apiId: string; apiToken: string }) => data)
  .handler(async ({ data }) => {
    const apiId = data.apiId.trim()
    const apiToken = data.apiToken.trim()
    const accountLabel = String(data.accountLabel || 'حساب Yalidine')
      .trim()
      .slice(0, 80)
    if (apiId.length < 4) throw new Error('API ID غير صالح')
    if (apiToken.length < 8) throw new Error('API Token غير صالح')

    const { userId, storeId, supabase } = await carrierContext()
    if (!supabase) {
      return {
        id: 'demo-yalidine',
        provider: 'yalidine',
        accountLabel,
        apiIdMasked: maskApiId(apiId),
        isActive: true,
        status: 'untested',
        lastTestedAt: null,
        lastError: null,
        updatedAt: new Date().toISOString(),
      } satisfies DeliveryCarrierConnection
    }

    const { data: saved, error } = await supabase
      .from('delivery_carrier_connections')
      .upsert(
        {
          store_id: storeId,
          provider: 'yalidine',
          account_label: accountLabel,
          api_id: apiId,
          api_token_encrypted: await encryptCarrierCredential(apiToken),
          base_url: YALIDINE_BASE_URL,
          is_active: true,
          connection_status: 'untested',
          last_tested_at: null,
          last_error: null,
          created_by: userId,
        },
        { onConflict: 'store_id,provider' },
      )
      .select(
        'id,provider,account_label,api_id,api_token_encrypted,base_url,is_active,connection_status,last_tested_at,last_error,updated_at',
      )
      .single()
    if (error) throw error

    await supabase.from('audit_log').insert({
      store_id: storeId,
      actor_id: userId,
      action: 'save_delivery_carrier_connection',
      new_value: { provider: 'yalidine', connectionId: saved.id, accountLabel },
    })
    return toConnection(saved as CarrierConnectionRow)
  })

export const testSavedYalidineConnection = createServerFn({ method: 'POST' }).handler(async () => {
  const { userId, storeId, supabase } = await carrierContext()
  if (!supabase) return { connected: true as const }

  const { data, error } = await supabase
    .from('delivery_carrier_connections')
    .select(
      'id,provider,account_label,api_id,api_token_encrypted,base_url,is_active,connection_status,last_tested_at,last_error,updated_at',
    )
    .eq('store_id', storeId)
    .eq('provider', 'yalidine')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('اربط حساب Yalidine أولاً')

  const row = data as CarrierConnectionRow
  const testedAt = new Date().toISOString()
  try {
    await testYalidineCredentials({
      apiId: row.api_id,
      apiToken: await decryptCarrierCredential(row.api_token_encrypted),
      baseUrl: row.base_url,
    })
    await supabase
      .from('delivery_carrier_connections')
      .update({ connection_status: 'connected', last_tested_at: testedAt, last_error: null })
      .eq('id', row.id)
      .eq('store_id', storeId)
    await supabase.from('audit_log').insert({
      store_id: storeId,
      actor_id: userId,
      action: 'test_delivery_carrier_connection',
      new_value: { provider: 'yalidine', connected: true },
    })
    return { connected: true as const }
  } catch (connectionError) {
    const message =
      connectionError instanceof Error ? connectionError.message.slice(0, 300) : 'فشل الاتصال'
    await supabase
      .from('delivery_carrier_connections')
      .update({ connection_status: 'error', last_tested_at: testedAt, last_error: message })
      .eq('id', row.id)
      .eq('store_id', storeId)
    throw new Error(message, { cause: connectionError })
  }
})

export const deleteYalidineConnection = createServerFn({ method: 'POST' }).handler(async () => {
  const { userId, storeId, supabase } = await carrierContext()
  if (!supabase) return { success: true as const }
  const { error } = await supabase
    .from('delivery_carrier_connections')
    .delete()
    .eq('store_id', storeId)
    .eq('provider', 'yalidine')
  if (error) throw error
  await supabase.from('audit_log').insert({
    store_id: storeId,
    actor_id: userId,
    action: 'delete_delivery_carrier_connection',
    old_value: { provider: 'yalidine' },
  })
  return { success: true as const }
})
