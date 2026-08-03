import { createServerFn } from '@tanstack/react-start'
import { DEMO_MODE_SERVER as DEMO_MODE } from '~/config'
import { buildSystemHealth } from '~/lib/system-health'
import { getSupabaseAdminClient } from '~/utils/supabase-server'
import { requireAdmin } from './auth'
import { resolveDefaultStoreId } from './order-repository'

interface StoreIntegrationHealthRow {
  provider: string
  is_active: boolean
  last_synced_at: string | null
  last_received_at: string | null
  error_count: number | string
}

interface SyncRunHealthRow {
  id: string
  provider: string
  status: string
  error_count: number | string
  error_summary: unknown
  started_at: string
  finished_at: string | null
}

interface WriteQueueHealthRow {
  id: string
  status: string
  attempts: number
  last_error: string | null
  created_at: string
}

export const getSystemHealthOverview = createServerFn({ method: 'GET' }).handler(async () => {
  if (DEMO_MODE) {
    const generatedAt = new Date().toISOString()
    return {
      store: { id: 'demo-store', name: 'متجر تجريبي' },
      generatedAt,
      health: buildSystemHealth(
        {
          activeSheets: 1,
          lastSheetSyncAt: generatedAt,
          failedSyncRuns24h: 0,
          pendingWritebacks: 0,
          failedWritebacks: 0,
          activeWebhooks: 1,
          rejectedWebhooks24h: 0,
          deliveryExceptions: 0,
          carrierStatus: 'not_configured',
        },
        new Date(generatedAt),
      ),
      incidents: [],
      lastBackupAt: null,
    }
  }

  const userId = await requireAdmin()
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)
  const since24h = new Date(Date.now() - 24 * 3_600_000).toISOString()

  const [
    storeResult,
    integrationsResult,
    syncRunsResult,
    rejectedWebhookResult,
    recentRejectedWebhooksResult,
    writeQueueResult,
    deliveryExceptionsResult,
    carrierResult,
    backupResult,
  ] = await Promise.all([
    supabase.from('stores').select('id,name').eq('id', storeId).single(),
    supabase
      .from('store_integrations')
      .select('provider,is_active,last_synced_at,last_received_at,error_count')
      .eq('store_id', storeId),
    supabase
      .from('order_sync_runs')
      .select('id,provider,status,error_count,error_summary,started_at,finished_at')
      .eq('store_id', storeId)
      .gte('started_at', since24h)
      .order('started_at', { ascending: false })
      .limit(10),
    supabase
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('status', 'rejected')
      .gte('created_at', since24h),
    supabase
      .from('webhook_events')
      .select('id,error_message,created_at,external_order_id')
      .eq('store_id', storeId)
      .eq('status', 'rejected')
      .gte('created_at', since24h)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('integration_write_queue')
      .select('id,status,attempts,last_error,created_at')
      .eq('store_id', storeId)
      .in('status', ['pending', 'failed'])
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('delivery_shipments')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('status', 'exception'),
    supabase
      .from('delivery_carrier_connections')
      .select('connection_status,last_error,last_tested_at')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('audit_log')
      .select('created_at,new_value')
      .eq('store_id', storeId)
      .eq('action', 'system_backup_export')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const results = [
    storeResult,
    integrationsResult,
    syncRunsResult,
    rejectedWebhookResult,
    recentRejectedWebhooksResult,
    writeQueueResult,
    deliveryExceptionsResult,
    carrierResult,
    backupResult,
  ]
  const failedResult = results.find((result) => result.error)
  if (failedResult?.error) throw failedResult.error
  if (!storeResult.data) throw new Error('تعذر العثور على المتجر.')

  const generatedAt = new Date().toISOString()
  const integrations = (integrationsResult.data || []) as StoreIntegrationHealthRow[]
  const activeSheets = integrations.filter(
    (integration) => integration.provider === 'google_sheets_oauth' && integration.is_active,
  )
  const activeWebhooks = integrations.filter(
    (integration) => integration.provider === 'webhook' && integration.is_active,
  )
  const syncRuns = (syncRunsResult.data || []) as SyncRunHealthRow[]
  const writeQueue = (writeQueueResult.data || []) as WriteQueueHealthRow[]
  const failedSyncRuns = syncRuns.filter((run) => run.status === 'failed')
  const pendingWritebacks = writeQueue.filter((item) => item.status === 'pending')
  const failedWritebacks = writeQueue.filter((item) => item.status === 'failed')
  const carrierStatus = carrierResult.data?.connection_status || 'not_configured'
  const lastSheetSyncAt =
    activeSheets
      .map((integration) => integration.last_synced_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) || null

  const health = buildSystemHealth(
    {
      activeSheets: activeSheets.length,
      lastSheetSyncAt,
      failedSyncRuns24h: failedSyncRuns.length,
      pendingWritebacks: pendingWritebacks.length,
      failedWritebacks: failedWritebacks.length,
      activeWebhooks: activeWebhooks.length,
      rejectedWebhooks24h: rejectedWebhookResult.count || 0,
      deliveryExceptions: deliveryExceptionsResult.count || 0,
      carrierStatus,
    },
    new Date(generatedAt),
  )

  const incidents = [
    ...failedSyncRuns.map((run) => ({
      id: `sync-${run.id}`,
      source: 'Google Sheets',
      severity: 'critical' as const,
      message: 'فشلت عملية مزامنة الطلبات.',
      details: Array.isArray(run.error_summary) ? JSON.stringify(run.error_summary[0] || '') : '',
      occurredAt: run.finished_at || run.started_at,
    })),
    ...(recentRejectedWebhooksResult.data || []).map((event) => ({
      id: `webhook-${event.id}`,
      source: 'ربط المتجر',
      severity: 'warning' as const,
      message: event.error_message || 'تم رفض طلب وارد من المتجر.',
      details: event.external_order_id ? `الطلب الخارجي: ${event.external_order_id}` : '',
      occurredAt: event.created_at,
    })),
    ...failedWritebacks.map((item) => ({
      id: `writeback-${item.id}`,
      source: 'Google Sheets',
      severity: 'critical' as const,
      message: item.last_error || 'فشل تحديث الطلب في Google Sheets.',
      details: `${item.attempts} محاولات`,
      occurredAt: item.created_at,
    })),
    ...(carrierStatus === 'error'
      ? [
          {
            id: 'carrier-error',
            source: 'شركة التوصيل',
            severity: 'critical' as const,
            message: carrierResult.data?.last_error || 'فشل اتصال شركة التوصيل.',
            details: '',
            occurredAt: carrierResult.data?.last_tested_at || generatedAt,
          },
        ]
      : []),
  ]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 20)

  return {
    store: storeResult.data,
    generatedAt,
    health,
    incidents,
    lastBackupAt: backupResult.data?.created_at || null,
  }
})

export const recordBackupExport = createServerFn({ method: 'POST' })
  .validator((data: { orderCount: number; fileName: string; byteSize: number }) => data)
  .handler(async ({ data }) => {
    if (DEMO_MODE) return { createdAt: new Date().toISOString() }

    const userId = await requireAdmin()
    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const createdAt = new Date().toISOString()
    const { error } = await supabase.from('audit_log').insert({
      actor_id: userId,
      store_id: storeId,
      action: 'system_backup_export',
      new_value: {
        orderCount: Math.max(0, Math.floor(data.orderCount)),
        fileName: data.fileName.trim().slice(0, 120),
        byteSize: Math.max(0, Math.floor(data.byteSize)),
      },
      created_at: createdAt,
    })
    if (error) throw error
    return { createdAt }
  })
