import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getSubscriptionPlan,
  type SubscriptionPlanCode,
  type SubscriptionResource,
} from '~/lib/subscription-plans'

interface SubscriptionRow {
  plan_code: SubscriptionPlanCode
  status: 'trialing' | 'active' | 'past_due' | 'cancelled'
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end?: boolean
  cancelled_at?: string | null
}

export async function resolveSubscriptionPolicy(
  supabase: SupabaseClient,
  storeId: string,
  storeCreatedAt: string,
) {
  const { data, error } = await supabase
    .from('store_subscriptions')
    .select(
      'plan_code,status,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,cancelled_at',
    )
    .eq('store_id', storeId)
    .maybeSingle()
  const missing =
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    error?.message?.includes('store_subscriptions')
  if (error && !missing) throw error

  const row = data as SubscriptionRow | null
  if (row) {
    const trialExpired =
      row.status === 'trialing' &&
      Boolean(row.trial_ends_at) &&
      new Date(row.trial_ends_at as string).getTime() <= Date.now()
    const paidPeriodExpired =
      row.status === 'active' &&
      Boolean(row.current_period_end) &&
      new Date(row.current_period_end as string).getTime() <= Date.now()
    const inactive = row.status === 'cancelled' || row.status === 'past_due' || paidPeriodExpired
    return {
      planCode: trialExpired || inactive ? ('starter' as const) : row.plan_code,
      status: trialExpired || paidPeriodExpired ? ('expired' as const) : row.status,
      trialEndsAt: row.trial_ends_at,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end || false,
      cancelledAt: row.cancelled_at || null,
      persistent: true,
    }
  }
  const trialEndsAt = new Date(new Date(storeCreatedAt).getTime() + 14 * 86_400_000)
  const trialActive = trialEndsAt.getTime() > Date.now()
  return {
    planCode: trialActive ? ('growth' as const) : ('starter' as const),
    status: trialActive ? ('trialing' as const) : ('expired' as const),
    trialEndsAt: trialEndsAt.toISOString(),
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    persistent: false,
  }
}

async function getPolicy(supabase: SupabaseClient, storeId: string) {
  const { data: store, error } = await supabase
    .from('stores')
    .select('created_at')
    .eq('id', storeId)
    .single()
  if (error) throw error
  return resolveSubscriptionPolicy(supabase, storeId, store.created_at)
}

export async function assertStoreResourceLimit(
  supabase: SupabaseClient,
  storeId: string,
  resource: SubscriptionResource,
  currentUsage: number,
) {
  const plan = getSubscriptionPlan((await getPolicy(supabase, storeId)).planCode)
  const limit = plan.limits[resource]
  if (limit !== null && currentUsage >= limit) {
    throw new Error(`PLAN_LIMIT_REACHED: بلغت الحد المسموح في باقة ${plan.name}`)
  }
}

export async function assertStoreOrderCapacity(
  supabase: SupabaseClient,
  storeId: string,
  incomingOrders = 1,
) {
  if (incomingOrders <= 0) return
  const plan = getSubscriptionPlan((await getPolicy(supabase, storeId)).planCode)
  const limit = plan.limits.orders
  if (limit === null) return
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]))
  const start = new Date(Date.UTC(values.year, values.month - 1, 1) - 3_600_000).toISOString()
  const end = new Date(Date.UTC(values.year, values.month, 1) - 3_600_000).toISOString()
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .is('deleted_at', null)
    .gte('ordered_at', start)
    .lt('ordered_at', end)
  if (error) throw error
  if ((count || 0) + incomingOrders > limit) {
    throw new Error(`PLAN_LIMIT_REACHED: بلغت الحد الشهري للطلبات في باقة ${plan.name}`)
  }
}
