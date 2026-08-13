import { getSupabaseAdminClient } from '~/utils/supabase-server'
import { syncActiveGoogleSheetsInBackground } from './google-sheets'

const BACKUP_ACTION = 'system_backup_snapshot'
const BACKUP_RETENTION_DAYS = 30

type BackupSource = 'manual' | 'scheduled'

export async function createStoreBackupSnapshot({
  storeId,
  actorId,
  source,
}: {
  storeId: string
  actorId: string | null
  source: BackupSource
}) {
  const supabase = getSupabaseAdminClient()
  const [storeResult, ordersResult, integrationsResult, shipmentsResult] = await Promise.all([
    supabase.from('stores').select('id,name,slug,created_at').eq('id', storeId).single(),
    supabase
      .from('orders')
      .select('*')
      .eq('store_id', storeId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('store_integrations')
      .select('provider,external_account_id,config,is_active,last_synced_at,created_at,updated_at')
      .eq('store_id', storeId),
    supabase
      .from('delivery_shipments')
      .select('order_id,tracking_number,status,shipped_at,delivered_at,created_at,updated_at')
      .eq('store_id', storeId),
  ])

  const failed = [storeResult, ordersResult, integrationsResult, shipmentsResult].find(
    (result) => result.error,
  )
  if (failed?.error) throw failed.error

  const createdAt = new Date().toISOString()
  const snapshot = {
    schemaVersion: 1,
    source,
    createdAt,
    store: storeResult.data,
    orders: ordersResult.data || [],
    integrations: integrationsResult.data || [],
    shipments: shipmentsResult.data || [],
  }
  const serialized = JSON.stringify(snapshot)
  const { data, error } = await supabase
    .from('audit_log')
    .insert({
      actor_id: actorId,
      store_id: storeId,
      action: BACKUP_ACTION,
      new_value: snapshot,
      created_at: createdAt,
    })
    .select('id,created_at')
    .single()
  if (error) throw error

  return {
    id: data.id,
    createdAt: data.created_at,
    orderCount: snapshot.orders.length,
    byteSize: new TextEncoder().encode(serialized).length,
    source,
  }
}

async function createScheduledStoreBackups() {
  const supabase = getSupabaseAdminClient()
  const dueBefore = new Date(Date.now() - 20 * 3_600_000).toISOString()
  const { data: stores, error } = await supabase.from('stores').select('id').limit(100)
  if (error) throw error

  const results: Array<{
    storeId: string
    ok: boolean
    skipped?: boolean
    orderCount?: number
    error?: string
  }> = []

  for (const store of stores || []) {
    const { data: latest, error: latestError } = await supabase
      .from('audit_log')
      .select('created_at')
      .eq('store_id', store.id)
      .eq('action', BACKUP_ACTION)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestError) {
      results.push({ storeId: store.id, ok: false, error: latestError.message })
      continue
    }
    if (latest?.created_at && latest.created_at > dueBefore) {
      results.push({ storeId: store.id, ok: true, skipped: true })
      continue
    }

    try {
      const backup = await createStoreBackupSnapshot({
        storeId: store.id,
        actorId: null,
        source: 'scheduled',
      })
      results.push({ storeId: store.id, ok: true, orderCount: backup.orderCount })
    } catch (backupError) {
      results.push({
        storeId: store.id,
        ok: false,
        error: backupError instanceof Error ? backupError.message : 'Backup failed',
      })
    }
  }

  const retentionBefore = new Date(
    Date.now() - BACKUP_RETENTION_DAYS * 24 * 3_600_000,
  ).toISOString()
  const { error: retentionError } = await supabase
    .from('audit_log')
    .delete()
    .eq('action', BACKUP_ACTION)
    .lt('created_at', retentionBefore)
  if (retentionError) throw retentionError

  return {
    stores: stores?.length || 0,
    created: results.filter((result) => result.ok && !result.skipped).length,
    skipped: results.filter((result) => result.skipped).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  }
}

export async function runScheduledMaintenance() {
  const startedAt = new Date().toISOString()
  const [sheets, backups] = await Promise.allSettled([
    syncActiveGoogleSheetsInBackground(),
    createScheduledStoreBackups(),
  ])

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    sheets:
      sheets.status === 'fulfilled'
        ? { ok: true, ...sheets.value }
        : {
            ok: false,
            error: sheets.reason instanceof Error ? sheets.reason.message : 'Sync failed',
          },
    backups:
      backups.status === 'fulfilled'
        ? { ok: true, ...backups.value }
        : {
            ok: false,
            error: backups.reason instanceof Error ? backups.reason.message : 'Backup failed',
          },
  }
}
