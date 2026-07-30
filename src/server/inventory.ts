import { createServerFn } from '@tanstack/react-start'
import type { InventorySetting } from '~/lib/product-inventory'
import { getSupabaseAdminClient } from '~/utils/supabase-server'
import { requireAdmin } from './auth'
import { resolveDefaultStoreId } from './order-repository'

const INVENTORY_PROVIDER = 'tflow_inventory'
const INVENTORY_ACCOUNT = 'catalog-v1'

interface InventoryConfig {
  products?: InventorySetting[]
}

export const getInventorySettings = createServerFn({ method: 'GET' }).handler(async () => {
  const userId = await requireAdmin()
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)
  const { data, error } = await supabase
    .from('store_integrations')
    .select('config')
    .eq('store_id', storeId)
    .eq('provider', INVENTORY_PROVIDER)
    .eq('external_account_id', INVENTORY_ACCOUNT)
    .maybeSingle()

  if (error) throw error
  const config = (data?.config || {}) as InventoryConfig
  return config.products || []
})

export const updateInventorySetting = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      productName: string
      stockQuantity: number
      lowStockThreshold: number
      unitCost: number
    }) => data,
  )
  .handler(async ({ data }) => {
    const userId = await requireAdmin()
    const productName = data.productName.trim()
    const stockQuantity = Math.max(Math.floor(Number(data.stockQuantity) || 0), 0)
    const lowStockThreshold = Math.max(Math.floor(Number(data.lowStockThreshold) || 0), 0)
    const unitCost = Math.max(Number(data.unitCost) || 0, 0)

    if (!productName) throw new Error('اسم المنتج مطلوب')

    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const { data: existing, error: readError } = await supabase
      .from('store_integrations')
      .select('config')
      .eq('store_id', storeId)
      .eq('provider', INVENTORY_PROVIDER)
      .eq('external_account_id', INVENTORY_ACCOUNT)
      .maybeSingle()

    if (readError) throw readError

    const config = (existing?.config || {}) as InventoryConfig
    const currentProducts = config.products || []
    const nextSetting: InventorySetting = {
      productName,
      stockQuantity,
      lowStockThreshold,
      unitCost,
      updatedAt: new Date().toISOString(),
    }
    const nextProducts = [
      ...currentProducts.filter((product) => product.productName !== productName),
      nextSetting,
    ].sort((a, b) => a.productName.localeCompare(b.productName, 'ar'))

    const { error: writeError } = await supabase.from('store_integrations').upsert(
      {
        store_id: storeId,
        provider: INVENTORY_PROVIDER,
        external_account_id: INVENTORY_ACCOUNT,
        config: { products: nextProducts },
        is_active: true,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,provider,external_account_id' },
    )

    if (writeError) throw writeError

    await supabase.from('audit_log').insert({
      actor_id: userId,
      action: 'update_inventory_setting',
      new_value: nextSetting,
      store_id: storeId,
    })

    return nextSetting
  })
