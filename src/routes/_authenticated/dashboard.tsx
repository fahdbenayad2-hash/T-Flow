import { createFileRoute, Link } from '@tanstack/react-router'
import { useOrders } from '~/lib/queries'
import { Skeleton } from '~/components/ui/skeleton'
import { ShoppingCart } from 'lucide-react'
import { STATUS_MAP, STATUS } from '~/lib/sheet-mapping'
import { formatCurrency } from '~/lib/utils'
import { ErrorState } from '~/components/empty-state'
import { useRole, getRoleLabel } from '~/hooks/useRole'
import { StatusBadge } from '~/components/status-badge'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[120px] w-full rounded-[16px]" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[110px] rounded-[15px]" />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[60px] rounded-[13px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-[260px] rounded-[15px]" />
        <Skeleton className="h-[260px] rounded-[15px]" />
      </div>
    </div>
  )
}

function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const { roles } = useRole()

  if (isLoading) return <DashboardSkeleton />
  if (isError)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    )

  const orders = data?.orders ?? []
  const n = orders.length

  const confirmed = orders.filter((o) =>
    ([STATUS.DELIVERED, STATUS.SHIPPED, STATUS.CONFIRMED] as string[]).includes(o.status),
  )
  const delivered = orders.filter((o) => o.status === STATUS.DELIVERED)
  const pending = orders.filter((o) =>
    ([STATUS.PROCESSING, STATUS.PREPARING] as string[]).includes(o.status),
  )
  const noAnswer = orders.filter((o) => o.status === STATUS.NO_ANSWER)
  const cancelled = orders.filter((o) => o.status === STATUS.CANCELLED)

  const confirmRate = n ? Math.round((confirmed.length / n) * 100) : 0
  const deliveryRate = n ? Math.round((delivered.length / n) * 100) : 0
  const totalRevenue = delivered.reduce(
    (sum, o) => sum + (Number(o.price) || 0) * (Number(o.quantity) || 1),
    0,
  )
  const avgOrderValue = delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0

  const statusCounts: Record<string, number> = {}
  orders.forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1
  })

  const statusDist = Object.entries(statusCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([status, count]) => {
      const info = STATUS_MAP[status as keyof typeof STATUS_MAP]
      return {
        status,
        count,
        pct: Math.round((count / n) * 100),
        color: info?.cssVar ? `var(${info.cssVar})` : '#6b7280',
      }
    })

  const roleLabel = roles.length > 0 ? getRoleLabel(roles[0]) : 'مستخدم'

  const primaryKpis = [
    {
      label: 'إجمالي الطلبات',
      value: n,
      iconColor: '#e31e24',
      iconBg: 'rgba(227,30,36,0.1)',
      accent: '#e31e24',
      trend: '+12.4%',
      trendLabel: 'مقابل الأسبوع الماضي',
      alert: false,
    },
    {
      label: 'نسبة التأكيد',
      value: confirmRate,
      suffix: '%',
      iconColor: '#3b82f6',
      iconBg: 'rgba(59,130,246,0.12)',
      accent: '#3b82f6',
      trend: '+4.1%',
      trendLabel: `${confirmed.length} طلب مؤكد`,
      alert: false,
    },
    {
      label: 'نسبة التسليم',
      value: deliveryRate,
      suffix: '%',
      iconColor: '#22c55e',
      iconBg: 'rgba(34,197,94,0.12)',
      accent: '#22c55e',
      trend: '+6.8%',
      trendLabel: `${delivered.length} تم تسليمه`,
      alert: false,
    },
    {
      label: 'طلبات معلّقة',
      value: pending.length,
      iconColor: '#e31e24',
      iconBg: 'rgba(227,30,36,0.1)',
      accent: '#e31e24',
      trend: 'يتطلب إجراء',
      trendLabel: 'راجع الطابور الآن',
      alert: true,
    },
  ]

  const secondaryKpis = [
    { label: 'الإيرادات المحققة', value: formatCurrency(totalRevenue), color: '#16a34a' },
    { label: 'متوسط قيمة الطلب', value: formatCurrency(avgOrderValue), color: undefined },
    { label: 'بدون رد', value: noAnswer.length, color: '#f97316' },
    { label: 'ملغية', value: cancelled.length, color: '#6b7280' },
  ]

  const today = new Date()
  const todayLabel = `${today.getDate()} ${today.toLocaleDateString('ar', { month: 'long', year: 'numeric' })}`

  return (
    <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
      {/* Hero banner */}
      <div
        className="relative overflow-hidden rounded-[16px] text-white p-6"
        style={{ background: 'linear-gradient(105deg, #0e1113 0%, #15181b 55%, #23110f 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.16] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-18deg, rgba(227,30,36,0.8) 0px, rgba(227,30,36,0.8) 2px, transparent 2px, transparent 40px)',
            WebkitMaskImage: 'linear-gradient(to left, black, transparent 65%)',
            maskImage: 'linear-gradient(to left, black, transparent 65%)',
          }}
        />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div
              className="font-mono text-[11px] tracking-[0.14em] mb-2"
              style={{ color: '#ff8286' }}
            >
              لوحة اليوم — {todayLabel}
            </div>
            <h2 className="text-[24px] font-black">مرحباً بعودتك، {roleLabel} 👋</h2>
            <p
              className="text-[13.5px] mt-1.5 max-w-[460px]"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              لديك <b className="text-white">{pending.length}</b> طلبات بحاجة للتأكيد و{' '}
              <b className="text-white">{noAnswer.length}</b> بدون رد. أداء التسليم اليوم ممتاز.
            </p>
          </div>
          <div className="flex gap-5">
            <div className="text-center">
              <div className="font-mono text-[30px] font-bold text-white">
                {confirmRate}
                <span className="text-[16px]">%</span>
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                نسبة التأكيد
              </div>
            </div>
            <div className="w-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
            <div className="text-center">
              <div className="font-mono text-[30px] font-bold" style={{ color: '#22c55e' }}>
                {deliveryRate}
                <span className="text-[16px]">%</span>
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                نسبة التسليم
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryKpis.map((kpi) => (
          <div
            key={kpi.label}
            className="relative overflow-hidden bg-card p-[18px] kpi-accent"
            style={{
              border: kpi.alert
                ? `1px solid ${kpi.accent}59`
                : '1px solid var(--color-card-border)',
              borderRadius: 'var(--color-card-radius)',
              boxShadow: kpi.alert ? `0 0 0 3px ${kpi.accent}0d` : 'none',
              ['--kpi-color' as string]: kpi.accent,
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[12.5px] text-muted-foreground font-medium">{kpi.label}</div>
                <div
                  className="font-mono text-[30px] font-bold mt-1.5 tracking-tight"
                  style={kpi.alert ? { color: '#c41a1f' } : undefined}
                >
                  {kpi.value}
                  {kpi.suffix || ''}
                </div>
              </div>
              <div
                className="flex items-center justify-center w-[38px] h-[38px] rounded-[11px] shrink-0"
                style={{ background: kpi.iconBg }}
              >
                <ShoppingCart className="w-[18px] h-[18px]" style={{ color: kpi.iconColor }} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3">
              <span
                className="text-[11.5px] font-bold"
                style={{ color: kpi.alert ? '#e31e24' : '#16a34a' }}
              >
                {kpi.trend}
              </span>
              <span className="text-[11px] text-muted-foreground">{kpi.trendLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryKpis.map((kpi) => (
          <div key={kpi.label} className="dc-card-sm p-3.5">
            <div className="text-[11.5px] text-muted-foreground">{kpi.label}</div>
            <div
              className="font-mono text-[19px] font-bold mt-1"
              style={kpi.color ? { color: kpi.color } : undefined}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Status distribution + Recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status distribution */}
        <div className="dc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14.5px] font-extrabold">توزيع حالات الطلبات</h3>
            <span className="font-mono text-[11px] text-muted-foreground">{n} طلب</span>
          </div>
          <div className="flex flex-col gap-3.5">
            {statusDist.map((s) => (
              <div key={s.status} className="flex items-center gap-3">
                <span
                  className="inline-flex items-center gap-1.5 min-w-[96px] text-[12px] font-semibold"
                  style={{ color: s.color }}
                >
                  <span
                    className="h-[7px] w-[7px] rounded-full shrink-0"
                    style={{ background: s.color }}
                  />
                  {s.status}
                </span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${s.pct}%`,
                      background: s.color,
                      transformOrigin: 'right',
                      animation: 'tfGrow 0.8s ease both',
                    }}
                  />
                </div>
                <span className="font-mono text-[11.5px] text-muted-foreground min-w-[54px] text-start">
                  {s.count} · {s.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <div className="dc-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14.5px] font-extrabold">آخر الطلبات</h3>
            <Link to="/orders" className="text-[12px] font-semibold text-primary hover:underline">
              عرض الكل ←
            </Link>
          </div>
          <div>
            {orders
              .slice(-6)
              .reverse()
              .map((order) => (
                <Link
                  key={order._row}
                  to="/orders/$row"
                  params={{ row: String(order._row) }}
                  className="flex items-center gap-3 py-2.5 border-b border-divider last:border-0"
                >
                  <div
                    className="flex items-center justify-center w-[34px] h-[34px] rounded-[10px] font-mono font-bold text-[11px] shrink-0"
                    style={{ background: 'rgba(227,30,36,0.09)', color: '#c41a1f' }}
                  >
                    {order._row}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold truncate">{order.customerName}</div>
                    <div className="text-[11.5px] text-muted-foreground truncate">
                      {order.product}
                    </div>
                  </div>
                  <div className="text-start shrink-0">
                    <StatusBadge status={order.status} />
                    <div className="font-mono text-[10.5px] text-muted-foreground mt-0.5" dir="ltr">
                      {order.phone}
                    </div>
                  </div>
                </Link>
              ))}
            {orders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد طلبات</p>
            )}
          </div>
        </div>
      </div>

      {data?.fromCache && (
        <p className="text-[10px] text-muted-foreground text-center">
          البيانات من الكاش — آخر تحديث: {new Date().toLocaleTimeString('ar-DZ')}
        </p>
      )}
    </div>
  )
}
