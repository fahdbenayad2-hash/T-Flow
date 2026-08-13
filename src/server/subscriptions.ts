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
  cancel_at_period_end?: boolean
  cancelled_at?: string | null
}

function isMissingSubscriptionTable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    error?.message?.includes('store_subscriptions')
  )
}

export async function resolveSubscription(
  supabase: AdminClient,
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

  if (error && !isMissingSubscriptionTable(error)) throw error

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
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    persistent: false,
  }
}

export async function getAdminStoreContext() {
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

function currentAlgiersMonthRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]))
  const start = new Date(Date.UTC(values.year, values.month - 1, 1) - 3_600_000)
  const end = new Date(Date.UTC(values.year, values.month, 1) - 3_600_000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function assertStoreOrderCapacity(
  supabase: AdminClient,
  storeId: string,
  incomingOrders = 1,
) {
  if (incomingOrders <= 0) return
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('created_at')
    .eq('id', storeId)
    .single()
  if (storeError) throw storeError
  const subscription = await resolveSubscription(supabase, storeId, store.created_at)
  const plan = getSubscriptionPlan(subscription.planCode)
  const limit = plan.limits.orders
  if (limit === null) return
  const { start, end } = currentAlgiersMonthRange()
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

  const { storeId, store, supabase } = await getAdminStoreContext()
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

    const { userId, storeId, supabase } = await getAdminStoreContext()
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
