import { createServerFn } from '@tanstack/react-start'
import { getSubscriptionPlan, type SubscriptionPlanCode } from '~/lib/subscription-plans'
import { DEMO_MODE_SERVER as DEMO_MODE } from '~/config'
import { getAdminStoreContext } from './subscriptions'

export interface SubscriptionInvoice {
  id: string
  planCode: SubscriptionPlanCode
  provider: string
  externalCheckoutId: string | null
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled'
  amount: number
  currency: string
  checkoutUrl: string | null
  paidAt: string | null
  periodStart: string | null
  periodEnd: string | null
  createdAt: string
}

function chargilyConfig() {
  const secretKey = process.env.CHARGILY_PAY_SECRET_KEY?.trim()
  const mode = process.env.CHARGILY_PAY_MODE === 'live' ? 'live' : 'test'
  return {
    configured: Boolean(secretKey),
    secretKey,
    mode,
    baseUrl:
      mode === 'live' ? 'https://pay.chargily.net/api/v2' : 'https://pay.chargily.net/test/api/v2',
  }
}

function isMissingBillingTable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    error?.message?.includes('subscription_invoices')
  )
}

export const getBillingOverview = createServerFn({ method: 'GET' }).handler(async () => {
  if (DEMO_MODE)
    return {
      paymentConfigured: false,
      paymentMode: 'test' as const,
      invoices: [] as SubscriptionInvoice[],
    }
  const { storeId, supabase } = await getAdminStoreContext()
  const { data, error } = await supabase
    .from('subscription_invoices')
    .select(
      'id,plan_code,provider,external_checkout_id,status,amount,currency,checkout_url,paid_at,period_start,period_end,created_at',
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error && !isMissingBillingTable(error)) throw error
  const config = chargilyConfig()
  return {
    paymentConfigured: config.configured,
    paymentMode: config.mode,
    migrationReady: !error,
    invoices: (data || []).map((row) => ({
      id: row.id,
      planCode: row.plan_code as SubscriptionPlanCode,
      provider: row.provider,
      externalCheckoutId: row.external_checkout_id,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      checkoutUrl: row.checkout_url,
      paidAt: row.paid_at,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      createdAt: row.created_at,
    })) as SubscriptionInvoice[],
  }
})

export const createSubscriptionCheckout = createServerFn({ method: 'POST' })
  .validator((data: { planCode: SubscriptionPlanCode }) => data)
  .handler(async ({ data }) => {
    if (DEMO_MODE) throw new Error('الدفع غير متاح في الوضع التجريبي')
    const plan = getSubscriptionPlan(data.planCode)
    if (plan.code === 'starter' || plan.monthlyPrice <= 0) throw new Error('اختر باقة مدفوعة')
    const config = chargilyConfig()
    if (!config.secretKey)
      throw new Error('بوابة الدفع جاهزة برمجياً وتحتاج مفتاح Chargily في إعدادات Vercel')

    const { userId, storeId, supabase } = await getAdminStoreContext()
    const { data: invoice, error: invoiceError } = await supabase
      .from('subscription_invoices')
      .insert({
        store_id: storeId,
        plan_code: plan.code,
        amount: plan.monthlyPrice,
        currency: 'dzd',
      })
      .select('id')
      .single()
    if (invoiceError) {
      if (isMissingBillingTable(invoiceError))
        throw new Error('يجب تطبيق ترحيل قاعدة بيانات الفوترة أولاً')
      throw invoiceError
    }

    const appUrl = (process.env.PUBLIC_APP_URL || 'https://orders-azure.vercel.app').replace(
      /\/$/,
      '',
    )
    try {
      const response = await fetch(`${config.baseUrl}/checkouts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: plan.monthlyPrice,
          currency: 'dzd',
          success_url: `${appUrl}/billing?payment=success`,
          failure_url: `${appUrl}/billing?payment=failed`,
          webhook_endpoint: `${appUrl}/api/payments/chargily/webhook`,
          description: `T-Flow ${plan.name} - شهر واحد`,
          locale: 'ar',
          metadata: { invoice_id: invoice.id, store_id: storeId, plan_code: plan.code },
        }),
      })
      const body = (await response.json()) as {
        id?: string
        checkout_url?: string
        message?: string
      }
      if (!response.ok || !body.id || !body.checkout_url)
        throw new Error(body.message || `CHARGILY_${response.status}`)
      const { error: updateError } = await supabase
        .from('subscription_invoices')
        .update({ external_checkout_id: body.id, checkout_url: body.checkout_url })
        .eq('id', invoice.id)
        .eq('store_id', storeId)
      if (updateError) throw updateError
      await supabase.from('audit_log').insert({
        actor_id: userId,
        store_id: storeId,
        action: 'subscription_checkout_created',
        new_value: { invoiceId: invoice.id, planCode: plan.code, mode: config.mode },
      })
      return { checkoutUrl: body.checkout_url }
    } catch (error) {
      await supabase
        .from('subscription_invoices')
        .update({
          status: 'failed',
          failure_reason: error instanceof Error ? error.message : 'CHECKOUT_FAILED',
        })
        .eq('id', invoice.id)
      throw error
    }
  })

export const cancelSubscriptionRenewal = createServerFn({ method: 'POST' }).handler(async () => {
  if (DEMO_MODE) return { success: true }
  const { userId, storeId, supabase } = await getAdminStoreContext()
  const { error } = await supabase
    .from('store_subscriptions')
    .update({ cancel_at_period_end: true, cancelled_at: new Date().toISOString() })
    .eq('store_id', storeId)
    .eq('status', 'active')
  if (error) throw error
  await supabase
    .from('audit_log')
    .insert({ actor_id: userId, store_id: storeId, action: 'subscription_renewal_cancelled' })
  return { success: true }
})

export const resumeSubscriptionRenewal = createServerFn({ method: 'POST' }).handler(async () => {
  if (DEMO_MODE) return { success: true }
  const { userId, storeId, supabase } = await getAdminStoreContext()
  const { error } = await supabase
    .from('store_subscriptions')
    .update({ cancel_at_period_end: false, cancelled_at: null })
    .eq('store_id', storeId)
    .eq('status', 'active')
  if (error) throw error
  await supabase
    .from('audit_log')
    .insert({ actor_id: userId, store_id: storeId, action: 'subscription_renewal_resumed' })
  return { success: true }
})
