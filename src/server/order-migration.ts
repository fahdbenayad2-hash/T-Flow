import { createServerFn } from '@tanstack/react-start'
import { DEMO_MODE_SERVER as DEMO_MODE, getOrderStorageMode } from '~/config'
import { requireAdmin } from './auth'
import { getOrderMigrationStatus, importOrdersToSupabase } from './order-repository'
import { fetchSheetOrders } from './sheet-orders'

export const previewOrderMigration = createServerFn({ method: 'GET' }).handler(async () => {
  const userId = await requireAdmin()
  if (DEMO_MODE) {
    return {
      storageMode: 'sheets' as const,
      sheetOrderCount: 0,
      supabaseOrderCount: 0,
      difference: 0,
      lastRun: null,
      demo: true,
    }
  }

  const [sheetOrders, status] = await Promise.all([
    fetchSheetOrders(),
    getOrderMigrationStatus(userId),
  ])

  return {
    storageMode: getOrderStorageMode(),
    sheetOrderCount: sheetOrders.length,
    supabaseOrderCount: status.orderCount,
    difference: sheetOrders.length - status.orderCount,
    lastRun: status.lastRun,
    demo: false,
  }
})

export const runOrderMigration = createServerFn({ method: 'POST' })
  .validator((data: { confirm: boolean }) => data)
  .handler(async ({ data }) => {
    if (!data.confirm) {
      return {
        ok: false as const,
        error: {
          code: 'CONFIRMATION_REQUIRED',
          message: 'Migration confirmation is required',
        },
      }
    }

    const userId = await requireAdmin()
    if (DEMO_MODE) {
      return {
        ok: false as const,
        error: {
          code: 'DEMO_MODE',
          message: 'Order migration is unavailable in demo mode',
        },
      }
    }

    try {
      const sheetOrders = await fetchSheetOrders()
      const summary = await importOrdersToSupabase(userId, sheetOrders)
      return { ok: true as const, data: summary }
    } catch (error) {
      console.error('Order migration failed:', error)
      return {
        ok: false as const,
        error: {
          code: 'MIGRATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown order migration error',
        },
      }
    }
  })
