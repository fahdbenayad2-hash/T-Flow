import { createHmac, timingSafeEqual } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { getSubscriptionPlan, type SubscriptionPlanCode } from '~/lib/subscription-plans'
import { getSupabaseAdminClient } from '~/utils/supabase-server'

function validSignature(payload: string, received: string | null, secret: string) {
  if (!received) return false
  const computed = createHmac('sha256', secret).update(payload).digest('hex')
  const actual = Buffer.from(received)
  const expected = Buffer.from(computed)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export const Route = createFileRoute('/api/payments/chargily/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CHARGILY_PAY_SECRET_KEY?.trim()
        if (!secret) return Response.json({ ok: false }, { status: 503 })
        const payload = await request.text()
        if (!validSignature(payload, request.headers.get('signature'), secret)) {
          return Response.json({ ok: false }, { status: 403 })
        }
        let event: {
          id?: string
          type?: string
          data?: {
            id?: string
            amount?: number
            currency?: string
            metadata?: Record<string, string>
          }
        }
        try {
          event = JSON.parse(payload)
        } catch {
          return Response.json({ ok: false }, { status: 400 })
        }
        const checkout = event.data
        if (!checkout?.id || !event.type) return Response.json({ ok: false }, { status: 400 })
        const supabase = getSupabaseAdminClient()
        const { data: invoice, error } = await supabase
          .from('subscription_invoices')
          .select('id,store_id,plan_code,amount,status')
          .eq('external_checkout_id', checkout.id)
          .maybeSingle()
        if (error || !invoice) return Response.json({ ok: false }, { status: 404 })
        if (invoice.status === 'paid') return Response.json({ ok: true })

        if (event.type === 'checkout.paid') {
          const plan = getSubscriptionPlan(invoice.plan_code as SubscriptionPlanCode)
          if (
            checkout.amount !== invoice.amount ||
            checkout.currency?.toLowerCase() !== 'dzd' ||
            plan.monthlyPrice !== invoice.amount
          ) {
            await supabase
              .from('subscription_invoices')
              .update({ status: 'failed', failure_reason: 'PAYMENT_DETAILS_MISMATCH' })
              .eq('id', invoice.id)
            return Response.json({ ok: false }, { status: 409 })
          }
          const periodStart = new Date()
          const periodEnd = new Date(periodStart)
          periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)
          const { error: activateError } = await supabase.from('store_subscriptions').upsert(
            {
              store_id: invoice.store_id,
              plan_code: invoice.plan_code,
              status: 'active',
              provider: 'chargily',
              external_subscription_id: checkout.id,
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
              cancel_at_period_end: false,
              cancelled_at: null,
            },
            { onConflict: 'store_id' },
          )
          if (activateError) return Response.json({ ok: false }, { status: 500 })
          await supabase
            .from('subscription_invoices')
            .update({
              status: 'paid',
              paid_at: periodStart.toISOString(),
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
            })
            .eq('id', invoice.id)
          await supabase.from('audit_log').insert({
            store_id: invoice.store_id,
            action: 'subscription_payment_confirmed',
            new_value: { invoiceId: invoice.id, eventId: event.id, planCode: invoice.plan_code },
          })
        } else if (event.type === 'checkout.failed' || event.type === 'checkout.canceled') {
          await supabase
            .from('subscription_invoices')
            .update({
              status: event.type === 'checkout.canceled' ? 'cancelled' : 'failed',
              failure_reason: event.type,
            })
            .eq('id', invoice.id)
        }
        return Response.json({ ok: true })
      },
    },
  },
})
