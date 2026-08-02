import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Check, CreditCard, Gauge, Link2, Sheet, ShoppingCart, Sparkles, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { ErrorState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'
import { Button } from '~/components/ui/button'
import {
  SUBSCRIPTION_PLANS,
  countOrdersInCurrentMonth,
  getSubscriptionPlan,
  getTrialDaysRemaining,
  getUsagePercent,
  getUsageStatus,
  type SubscriptionPlanCode,
  type SubscriptionResource,
} from '~/lib/subscription-plans'
import { useOrders, useRequestPlanUpgrade, useSubscriptionOverview } from '~/lib/queries'
import { cn, formatCurrency } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/billing')({
  component: BillingPage,
})

const RESOURCE_LABELS: Record<SubscriptionResource, string> = {
  orders: 'طلبات هذا الشهر',
  users: 'أعضاء الفريق',
  storeConnections: 'روابط المتاجر',
  sheetConnections: 'ملفات Google Sheets',
}

const RESOURCE_ICONS = {
  orders: ShoppingCart,
  users: Users,
  storeConnections: Link2,
  sheetConnections: Sheet,
}

function UsageCard({
  resource,
  value,
  limit,
}: {
  resource: SubscriptionResource
  value: number
  limit: number | null
}) {
  const Icon = RESOURCE_ICONS[resource]
  const percent = getUsagePercent(value, limit)
  const status = getUsageStatus(value, limit)
  return (
    <div className="dc-card p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[12px] text-muted-foreground mb-1">{RESOURCE_LABELS[resource]}</p>
          <p className="text-[22px] font-black font-mono" dir="ltr">
            {value} <span className="text-[12px] text-muted-foreground">/ {limit ?? '∞'}</span>
          </p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            status === 'blocked'
              ? 'bg-destructive'
              : status === 'warning'
                ? 'bg-amber-500'
                : 'bg-primary',
          )}
          style={{ width: limit === null ? '0%' : `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-[10.5px] text-muted-foreground">
        {limit === null
          ? 'غير محدود في باقتك'
          : status === 'blocked'
            ? 'وصلت إلى الحد المسموح'
            : status === 'warning'
              ? 'اقتربت من الحد المسموح'
              : `${percent}% من الحد مستعمل`}
      </p>
    </div>
  )
}

function PlanCard({
  code,
  currentCode,
  onRequest,
  requesting,
}: {
  code: SubscriptionPlanCode
  currentCode: SubscriptionPlanCode
  onRequest: (code: SubscriptionPlanCode) => void
  requesting: boolean
}) {
  const plan = getSubscriptionPlan(code)
  const isCurrent = plan.code === currentCode
  const rank = { starter: 0, growth: 1, pro: 2 }
  const canUpgrade = rank[plan.code] > rank[currentCode]

  return (
    <div
      className={cn(
        'dc-card relative flex flex-col p-5',
        plan.featured && 'ring-1 ring-primary/70',
      )}
    >
      {plan.featured && (
        <span className="absolute -top-3 right-5 rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-white">
          الأنسب للمتاجر
        </span>
      )}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[18px] font-black">{plan.name}</h3>
          {isCurrent && (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-500">
              باقتك الحالية
            </span>
          )}
        </div>
        <p className="mt-1 text-[11.5px] text-muted-foreground">{plan.description}</p>
        <div className="mt-4 flex items-end gap-1">
          <span className="text-[28px] font-black font-mono">
            {formatCurrency(plan.monthlyPrice)}
          </span>
          <span className="pb-1 text-[11px] text-muted-foreground">/ شهر</span>
        </div>
      </div>

      <div className="mb-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-center gap-2 text-[12px]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <Check className="h-3 w-3" />
            </span>
            {feature}
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant={plan.featured && canUpgrade ? 'default' : 'outline'}
        disabled={!canUpgrade || requesting}
        onClick={() => onRequest(plan.code)}
        className="w-full rounded-xl font-bold"
      >
        {isCurrent ? 'الباقة مفعّلة' : canUpgrade ? 'طلب الترقية' : 'مشمولة في باقتك'}
      </Button>
    </div>
  )
}

function BillingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-40 rounded-2xl skeleton-shimmer" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-36 rounded-2xl skeleton-shimmer" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-96 rounded-2xl skeleton-shimmer" />
        ))}
      </div>
    </div>
  )
}

function BillingPage() {
  const overviewQuery = useSubscriptionOverview()
  const ordersQuery = useOrders()
  const upgradeMutation = useRequestPlanUpgrade()
  const monthOrders = useMemo(
    () => countOrdersInCurrentMonth(ordersQuery.data?.orders || []),
    [ordersQuery.data],
  )

  if (overviewQuery.isLoading || ordersQuery.isLoading) return <BillingSkeleton />
  if (overviewQuery.isError || ordersQuery.isError) {
    const error = overviewQuery.error || ordersQuery.error
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => {
          overviewQuery.refetch()
          ordersQuery.refetch()
        }}
      />
    )
  }

  const overview = overviewQuery.data!
  const currentPlan = getSubscriptionPlan(overview.subscription.planCode)
  const trialDays = getTrialDaysRemaining(overview.subscription.trialEndsAt)
  const usage = { orders: monthOrders, ...overview.usage }

  const requestUpgrade = (planCode: SubscriptionPlanCode) => {
    upgradeMutation.mutate(planCode, {
      onSuccess: () => toast.success('تم تسجيل طلب الترقية. سنتواصل معك لإتمام التفعيل.'),
      onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تسجيل الطلب'),
    })
  }

  return (
    <RoleGuard roles={['admin']}>
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
        <section className="relative overflow-hidden rounded-[18px] border border-primary/20 bg-gradient-to-l from-primary/15 via-card to-card p-6">
          <div className="absolute -left-12 -top-16 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="font-mono text-[10px] font-bold tracking-[0.14em]">
                  T-FLOW PLANS
                </span>
              </div>
              <h2 className="text-[25px] font-black">باقتك واستعمال المتجر</h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                راقب الاستعمال قبل بلوغ الحد واختر الباقة المناسبة لنمو {overview.store.name}.
              </p>
            </div>
            <div className="min-w-[240px] rounded-2xl border border-border/70 bg-background/70 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10.5px] text-muted-foreground">الباقة الحالية</p>
                  <p className="mt-1 text-[20px] font-black">{currentPlan.name}</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
                  <CreditCard className="h-5 w-5" />
                </span>
              </div>
              {overview.subscription.status === 'trialing' && trialDays > 0 && (
                <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-500">
                  الفترة التجريبية: بقي {trialDays} يوم
                </p>
              )}
              {overview.subscription.status === 'expired' && (
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                  انتهت التجربة وتم الرجوع تلقائياً إلى باقة البداية.
                </p>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h3 className="text-[15px] font-extrabold">استهلاك الباقة</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {(Object.keys(usage) as SubscriptionResource[]).map((resource) => (
              <UsageCard
                key={resource}
                resource={resource}
                value={usage[resource]}
                limit={currentPlan.limits[resource]}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h3 className="text-[17px] font-black">اختر الباقة المناسبة</h3>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              الأسعار شهرية بالدينار الجزائري. الدفع الإلكتروني سيُربط بعد اعتماد بوابة الدفع.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <PlanCard
                key={plan.code}
                code={plan.code}
                currentCode={currentPlan.code}
                onRequest={requestUpgrade}
                requesting={upgradeMutation.isPending}
              />
            ))}
          </div>
        </section>
      </div>
    </RoleGuard>
  )
}
