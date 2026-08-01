import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useOrders } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import { cn, formatCurrency } from '~/lib/utils'
import { STATUS } from '~/lib/sheet-mapping'
import { FadeIn, StaggerContainer, StaggerItem } from '~/components/page-transition'
import { ErrorState } from '~/components/empty-state'
import { StatusBadge } from '~/components/status-badge'
import {
  aggregateCustomers,
  getCustomerInsight,
  getCustomerValueSummary,
  normalizeAlgerianPhone,
} from '~/lib/customer-insights'

export const Route = createFileRoute('/_authenticated/customers/$phone')({
  component: CustomerDetailPage,
})

function CustomerDetailPage() {
  const { phone } = Route.useParams()
  const router = useRouter()
  const { data, isLoading, isError, error, refetch } = useOrders()

  const orders = useMemo(() => data?.orders ?? [], [data])
  const customerOrders = useMemo(
    () => orders.filter((o) => String(o.phone) === phone),
    [orders, phone],
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-32 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (isError || customerOrders.length === 0) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'لم يتم العثور على العميل'}
        onRetry={() => refetch()}
      />
    )
  }

  const firstOrder = customerOrders[0]
  const customerValue = getCustomerValueSummary(customerOrders)
  const cancelledCount = customerOrders.filter((o) => o.status === STATUS.CANCELLED).length
  const noAnswerCount = customerOrders.filter((o) => o.status === STATUS.NO_ANSWER).length
  const deliveredCount = customerOrders.filter((o) => o.status === STATUS.DELIVERED).length
  const customer = aggregateCustomers(customerOrders)[0]
  const insight = getCustomerInsight(customer)
  const normalizedPhone = normalizeAlgerianPhone(phone)
  const insightStyle = {
    loyal: {
      icon: CheckCircle2,
      className: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    },
    needs_follow_up: {
      icon: AlertTriangle,
      className: 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400',
    },
    new: {
      icon: Sparkles,
      className: 'border-sky-500/20 bg-sky-500/5 text-sky-600 dark:text-sky-400',
    },
  }[insight.segment]
  const InsightIcon = insightStyle.icon

  return (
    <StaggerContainer className="space-y-4">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.navigate({ to: '/customers' })}
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{firstOrder.customerName}</h2>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold',
                    insightStyle.className,
                  )}
                >
                  <InsightIcon className="h-3 w-3" />
                  {insight.segmentLabel}
                </span>
              </div>
              <p className="text-sm text-muted-foreground font-mono mt-0.5" dir="ltr">
                {phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <a
                href={`https://wa.me/${normalizedPhone.replace('+', '')}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                واتساب
              </a>
            </Button>
            <Button asChild className="flex-1 sm:flex-none">
              <a href={`tel:${normalizedPhone}`}>
                <Phone className="h-4 w-4" />
                اتصال
              </a>
            </Button>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.08}>
        <div
          className={cn(
            'flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border p-4',
            insightStyle.className,
          )}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-background/70 p-2.5">
              <InsightIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold">{insight.segmentLabel}</p>
              <p className="text-xs opacity-80 mt-1">{insight.segmentHint}</p>
            </div>
          </div>
          <div className="flex items-center gap-5 rounded-xl bg-background/70 px-4 py-2.5">
            <div>
              <p className="font-mono text-lg font-bold">{insight.deliveredCount}</p>
              <p className="text-[10px] opacity-75">ناجح</p>
            </div>
            <div className="h-8 w-px bg-current opacity-15" />
            <div>
              <p className="font-mono text-lg font-bold">{insight.failedCount}</p>
              <p className="text-[10px] opacity-75">غير ناجح</p>
            </div>
            <div className="h-8 w-px bg-current opacity-15" />
            <div>
              <p className="font-mono text-lg font-bold">
                {insight.deliveredCount + insight.failedCount > 0
                  ? `${insight.deliveryRate}%`
                  : '—'}
              </p>
              <p className="text-[10px] opacity-75">نسبة التوصيل</p>
            </div>
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StaggerItem>
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">الطلبات</span>
              </div>
              <p className="text-2xl font-bold font-mono">{customerOrders.length}</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">الإنفاق الفعلي</span>
              </div>
              <p className="text-2xl font-bold font-mono">{formatCurrency(customerValue.spent)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                الطلبات المسلّمة فقط · قيد المعالجة {formatCurrency(customerValue.active)}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">تم التسليم</span>
              </div>
              <p className="text-2xl font-bold font-mono text-[var(--status-delivered)]">
                {deliveredCount}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Ban className="h-4 w-4 text-[var(--status-cancelled)]" />
                <span className="text-xs text-muted-foreground">إلغاء / لا يرد</span>
              </div>
              <p className="text-2xl font-bold font-mono">
                <span className="text-[var(--status-cancelled)]">{cancelledCount}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-[var(--status-no-answer)]">{noAnswerCount}</span>
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
      </div>

      <FadeIn delay={0.2}>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              العنوان
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {firstOrder.wilaya} — {firstOrder.baladiya} — {firstOrder.address}
            </p>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.25}>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base">سجل الطلبات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {customerOrders.map((order) => {
                return (
                  <div
                    key={order._row}
                    className="flex items-center justify-between py-3 border-b last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/orders/$row"
                          params={{ row: String(order._row) }}
                          className="text-primary hover:underline text-sm font-medium"
                        >
                          {order.order_id}
                        </Link>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.product} — {order.color}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="font-mono text-sm">
                        {formatCurrency(Number(order.price) || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">{order.date.slice(0, 12)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </StaggerContainer>
  )
}
