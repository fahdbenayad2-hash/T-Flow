import { createServerFn } from '@tanstack/react-start'
import {
  getSubscriptionPlan,
  type SubscriptionPlanCode,
  type SubscriptionResource,
} from '~/lib/subscription-plans'
import { DEMO_MODE_SERVER as DEMO_MODE } from '~/config'
import { getSupabaseAdminClient } from '~/utils/supabase-server'
import { requireAdmin } from './auth'
import { resolveDefaultStoreId } from './order-repository'

type AdminClient = ReturnType<typeof getSupabaseAdminClient>

interface SubscriptionRow {
  plan_code: SubscriptionPlanCode
  status: 'trialing' | 'active' | 'past_due' | 'cancelled'
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
}

function isMissingSubscriptionTable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    error?.message?.includes('store_subscriptions')
  )
}

async function resolveSubscription(supabase: AdminClient, storeId: string, storeCreatedAt: string) {
  const { data, error } = await supabase
    .from('store_subscriptions')
    .select('plan_code,status,trial_ends_at,current_period_start,current_period_end')
    .eq('store_id', storeId)
    .maybeSingle()

  if (error && !isMissingSubscriptionTable(error)) throw error

  const row = data as SubscriptionRow | null
  if (row) {
    const trialExpired =
      row.status === 'trialing' &&
      Boolean(row.trial_ends_at) &&
      new Date(row.trial_ends_at as string).getTime() <= Date.now()
    return {
      planCode: trialExpired ? ('starter' as const) : row.plan_code,
      status: trialExpired ? ('expired' as const) : row.status,
      trialEndsAt: row.trial_ends_at,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      persistent: true,
    }
  }

  // Safe compatibility path until migration 009 is installed. Existing stores
  // receive the same 14-day Growth trial derived from their creation date.
  const trialEndsAt = new Date(new Date(storeCreatedAt).getTime() + 14 * 86_400_000)
  const trialActive = trialEndsAt.getTime() > Date.now()
  return {
    planCode: trialActive ? ('growth' as const) : ('starter' as const),
    status: trialActive ? ('trialing' as const) : ('expired' as const),
    trialEndsAt: trialEndsAt.toISOString(),
    currentPeriodStart: null,
    currentPeriodEnd: null,
    persistent: false,
  }
}

async function getStoreContext() {
  const userId = await requireAdmin()
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)
  const { data: store, error } = await supabase
    .from('stores')
    .select('id,name,created_at')
    .eq('id', storeId)
    .single()
  if (error) throw error
  return { userId, storeId, store, supabase }
}

export async function assertStoreResourceLimit(
  supabase: AdminClient,
  storeId: string,
  resource: SubscriptionResource,
  currentUsage: number,
) {
  const { data: store, error } = await supabase
    .from('stores')
    .select('created_at')
    .eq('id', storeId)
    .single()
  if (error) throw error

  const subscription = await resolveSubscription(supabase, storeId, store.created_at)
  const plan = getSubscriptionPlan(subscription.planCode)
  const limit = plan.limits[resource]
  if (limit !== null && currentUsage >= limit) {
    throw new Error(`PLAN_LIMIT_REACHED: بلغت الحد المسموح في باقة ${plan.name}`)
  }
}

export const getSubscriptionOverview = createServerFn({ method: 'GET' }).handler(async () => {
  if (DEMO_MODE) {
    return {
      store: { id: 'demo-store', name: 'متجر تجريبي' },
      subscription: {
        planCode: 'growth' as const,
        status: 'trialing' as const,
        trialEndsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        persistent: true,
      },
      usage: { users: 1, storeConnections: 1, sheetConnections: 1 },
    }
  }

  const { storeId, store, supabase } = await getStoreContext()
  const [subscription, membersResult, webhooksResult, sheetsResult] = await Promise.all([
    resolveSubscription(supabase, storeId, store.created_at),
    supabase.from('store_members').select('user_id').eq('store_id', storeId).eq('is_active', true),
    supabase
      .from('store_integrations')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('provider', 'webhook')
      .eq('is_active', true),
    supabase
      .from('store_integrations')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('provider', 'google_sheets_oauth')
      .eq('is_active', true),
  ])

  if (membersResult.error) throw membersResult.error
  if (webhooksResult.error) throw webhooksResult.error
  if (sheetsResult.error) throw sheetsResult.error

  return {
    store: { id: store.id, name: store.name },
    subscription,
    usage: {
      users: new Set((membersResult.data || []).map((member) => member.user_id)).size,
      storeConnections: webhooksResult.count || 0,
      sheetConnections: sheetsResult.count || 0,
    },
  }
})

export const requestPlanUpgrade = createServerFn({ method: 'POST' })
  .validator((data: { planCode: SubscriptionPlanCode }) => data)
  .handler(async ({ data }) => {
    if (DEMO_MODE) return { success: true }
    const requestedPlan = getSubscriptionPlan(data.planCode)
    if (requestedPlan.code === 'starter') throw new Error('اختر باقة مدفوعة للترقية')

    const { userId, storeId, supabase } = await getStoreContext()
    const { error } = await supabase.from('audit_log').insert({
      actor_id: userId,
      store_id: storeId,
      action: 'request_plan_upgrade',
      new_value: {
        planCode: requestedPlan.code,
        planName: requestedPlan.name,
        monthlyPrice: requestedPlan.monthlyPrice,
      },
    })
    if (error) throw error
    return { success: true }
  })
