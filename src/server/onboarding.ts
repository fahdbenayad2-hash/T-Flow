import { createServerFn } from '@tanstack/react-start'
import { DEMO_MODE_SERVER as DEMO_MODE } from '~/config'
import { getAdminStoreContext } from './subscriptions'

export const getSellerOnboarding = createServerFn({ method: 'GET' }).handler(async () => {
  if (DEMO_MODE) return { completed: 3, total: 4, percent: 75, steps: [] }
  const { storeId, store, supabase } = await getAdminStoreContext()
  const [sources, orders, inventory] = await Promise.all([
    supabase
      .from('store_integrations')
      .select('id,provider', { count: 'exact' })
      .eq('store_id', storeId)
      .eq('is_active', true)
      .in('provider', ['webhook', 'google_sheets_oauth']),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .is('deleted_at', null),
    supabase
      .from('store_integrations')
      .select('config')
      .eq('store_id', storeId)
      .eq('provider', 'tflow_inventory')
      .eq('is_active', true)
      .maybeSingle(),
  ])
  if (sources.error) throw sources.error
  if (orders.error) throw orders.error
  if (inventory.error) throw inventory.error
  const inventoryProducts = (
    (inventory.data?.config as { products?: unknown[] } | null)?.products || []
  ).length
  const hasWebhook = (sources.data || []).some((source) => source.provider === 'webhook')
  const hasSheet = (sources.data || []).some((source) => source.provider === 'google_sheets_oauth')
  const steps = [
    {
      key: 'store',
      title: 'حساب المتجر',
      description: `متجر ${store.name} جاهز للعمل`,
      done: true,
      to: '/settings',
    },
    {
      key: 'source',
      title: 'ربط مصدر الطلبات',
      description: hasSheet
        ? 'Google Sheets مربوط'
        : hasWebhook
          ? 'رابط المتجر جاهز'
          : 'اربط متجرك أو ملف Google Sheets',
      done: hasSheet || hasWebhook,
      to: hasWebhook ? '/integrations' : '/google-sheets',
    },
    {
      key: 'order',
      title: 'استقبال أول طلب',
      description: orders.count
        ? `تم استقبال ${orders.count} طلب`
        : 'أرسل طلباً تجريبياً للتأكد من الربط',
      done: (orders.count || 0) > 0,
      to: '/orders',
    },
    {
      key: 'inventory',
      title: 'ضبط المخزون والتكلفة',
      description: inventoryProducts
        ? `${inventoryProducts} منتجات مضبوطة`
        : 'أضف مخزون وتكلفة منتج واحد على الأقل',
      done: inventoryProducts > 0,
      to: '/products',
    },
  ]
  const completed = steps.filter((step) => step.done).length
  return {
    completed,
    total: steps.length,
    percent: Math.round((completed / steps.length) * 100),
    steps,
  }
})
