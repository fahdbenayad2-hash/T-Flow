import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useInventorySettings, useOrders } from '~/lib/queries'
import { AlertTriangle, DollarSign } from 'lucide-react'
import { STATUS } from '~/lib/sheet-mapping'
import { formatCurrency } from '~/lib/utils'
import { ErrorState, EmptyState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'
import { getOrderTotal } from '~/lib/order-record'
import { buildProfitabilityInsights } from '~/lib/profitability-insights'
import { getOrderReportDate } from '~/lib/report-insights'

export const Route = createFileRoute('/_authenticated/earnings')({
  component: EarningsPage,
})

function EarningsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[110px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
      <div className="h-[260px] rounded-[15px] skeleton-shimmer" />
      <div className="h-[300px] rounded-[15px] skeleton-shimmer" />
    </div>
  )
}

function EarningsPage() {
  const ordersQuery = useOrders()
  const inventoryQuery = useInventorySettings()

  const orders = useMemo(() => ordersQuery.data?.orders ?? [], [ordersQuery.data])
  const inventorySettings = useMemo(() => inventoryQuery.data ?? [], [inventoryQuery.data])
  const profitability = useMemo(
    () => buildProfitabilityInsights(orders, inventorySettings),
    [inventorySettings, orders],
  )

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o.status === STATUS.DELIVERED)

    // Monthly trend — last 6 months
    const monthlyMap = new Map<string, { revenue: number; orders: number }>()
    for (const o of delivered) {
      const orderDate = getOrderReportDate(o)
      if (!orderDate) continue
      const month = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`
      const existing = monthlyMap.get(month) || { revenue: 0, orders: 0 }
      existing.revenue += getOrderTotal(o)
      existing.orders++
      monthlyMap.set(month, existing)
    }
    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)

    // Monthly growth (compare last month vs previous)
    let monthlyGrowth = 0
    if (monthlyTrend.length >= 2) {
      const last = monthlyTrend[monthlyTrend.length - 1][1].revenue
      const prev = monthlyTrend[monthlyTrend.length - 2][1].revenue
      monthlyGrowth = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0
    }

    return {
      monthlyGrowth,
      monthlyTrend,
      maxMonthlyRevenue:
        monthlyTrend.length > 0 ? Math.max(...monthlyTrend.map(([, d]) => d.revenue)) : 1,
      maxProductRevenue:
        profitability.productEntries.length > 0 ? profitability.productEntries[0].revenue : 1,
    }
  }, [orders, profitability.productEntries])

  if (ordersQuery.isLoading || inventoryQuery.isLoading) return <EarningsSkeleton />

  if (ordersQuery.isError || inventoryQuery.isError) {
    const error = ordersQuery.error || inventoryQuery.error
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => {
          ordersQuery.refetch()
          inventoryQuery.refetch()
        }}
      />
    )
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<DollarSign className="h-8 w-8 text-muted-foreground" />}
        title="لا توجد بيانات مالية"
      />
    )
  }

  const kpis = [
    {
      label: 'الإيرادات المحققة',
      value: formatCurrency(profitability.totalRevenue),
      detail: `${profitability.deliveredCount} طلب مسلّم`,
      accent: '#22c55e',
    },
    {
      label: 'تكلفة المنتجات المسجّلة',
      value: formatCurrency(profitability.knownProductCost),
      detail: `محسوبة على ${profitability.costedOrders} طلب`,
      accent: '#f59e0b',
    },
    {
      label: profitability.isProfitComplete ? 'الربح الإجمالي' : 'الربح المغطّى',
      value: formatCurrency(profitability.grossProfit),
      detail: `هامش ${profitability.grossMargin}% ضمن الطلبات المغطاة`,
      accent: '#3b82f6',
    },
    {
      label: 'تغطية تكاليف المنتجات',
      value: `${profitability.costCoverage}%`,
      detail:
        profitability.uncostedOrders > 0
          ? `${profitability.uncostedOrders} طلب بلا تكلفة مسجّلة`
          : 'كل الطلبات المسلّمة مغطاة',
      accent: profitability.costCoverage === 100 ? '#8b5cf6' : '#ef4444',
    },
  ]

  const secondaryKpis = [
    { label: 'متوسط الطلب المسلّم', value: formatCurrency(profitability.averageOrderValue) },
    { label: 'طلبات تم تسليمها', value: profitability.deliveredCount },
    {
      label: 'نمو آخر شهر',
      value: `${stats.monthlyGrowth > 0 ? '+' : ''}${stats.monthlyGrowth}%`,
    },
  ]

  const monthLabels: Record<string, string> = {
    '01': 'يناير',
    '02': 'فبراير',
    '03': 'مارس',
    '04': 'أبريل',
    '05': 'مايو',
    '06': 'يونيو',
    '07': 'يوليو',
    '08': 'أغسطس',
    '09': 'سبتمبر',
    '10': 'أكتوبر',
    '11': 'نوفمبر',
    '12': 'ديسمبر',
  }

  return (
    <RoleGuard roles={['admin']}>
      <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="relative overflow-hidden bg-card p-[18px] kpi-accent"
              style={{
                border: '1px solid var(--color-card-border)',
                borderRadius: 'var(--color-card-radius)',
                ['--kpi-color' as string]: kpi.accent,
              }}
            >
              <div className="text-[12.5px] text-muted-foreground font-medium">{kpi.label}</div>
              <div
                className="font-mono text-[22px] font-bold mt-1.5 tracking-tight"
                style={{ color: kpi.accent }}
              >
                {kpi.value}
              </div>
              <div className="mt-1.5 text-[10.5px] text-muted-foreground">{kpi.detail}</div>
            </div>
          ))}
        </div>

        {profitability.uncostedOrders > 0 && (
          <div className="flex flex-col gap-3 rounded-[15px] border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-[13px] font-bold">الربح مازال جزئياً</p>
                <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                  يوجد {profitability.uncostedOrders} طلب مسلّم لمنتجات بلا تكلفة وحدة. الربح
                  المعروض يحسب فقط الطلبات التي عُرّفت تكلفتها حتى لا يعطيك رقماً مضلّلاً.
                </p>
              </div>
            </div>
            <Link
              to="/products"
              className="shrink-0 rounded-lg border border-amber-500/30 bg-background px-3 py-2 text-center text-[11.5px] font-bold text-amber-600 hover:bg-amber-500/10 dark:text-amber-300"
            >
              إكمال تكاليف المنتجات
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {secondaryKpis.map((kpi) => (
            <div key={kpi.label} className="dc-card-sm p-3.5">
              <div className="text-[11.5px] text-muted-foreground">{kpi.label}</div>
              <div className="mt-1 font-mono text-[19px] font-bold">{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Bar chart — Monthly revenue trend */}
        <div className="dc-card p-5">
          <h3 className="text-[14.5px] font-extrabold mb-5">الإيرادات الشهرية</h3>
          <div className="flex items-end justify-around gap-3" style={{ height: '180px' }}>
            {stats.monthlyTrend.map(([month, data]) => {
              const heightPercent =
                stats.maxMonthlyRevenue > 0 ? (data.revenue / stats.maxMonthlyRevenue) * 100 : 0
              const monthPart = month.slice(5, 7)
              const label = monthLabels[monthPart] || monthPart

              return (
                <div key={month} className="flex flex-col items-center gap-2 flex-1">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatCurrency(data.revenue)}
                  </span>
                  <div
                    className="w-full max-w-[36px] rounded-t-[8px]"
                    style={{
                      height: `${Math.max(heightPercent, 4)}%`,
                      background: 'linear-gradient(180deg, #e31e24, #7d1622)',
                      animation: 'tfRise 0.8s ease both',
                      transformOrigin: 'bottom',
                    }}
                  />
                  <span className="text-[10.5px] text-muted-foreground">{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Product profitability */}
        <div className="dc-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[14.5px] font-extrabold">ربحية المنتجات</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                الإيراد والربح الإجمالي للطلبات المسلّمة فقط
              </p>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-[10.5px] text-muted-foreground">
              التغطية {profitability.costCoverage}%
            </span>
          </div>
          <div className="flex flex-col gap-3.5">
            {profitability.productEntries.map((product) => {
              const percent =
                stats.maxProductRevenue > 0
                  ? Math.round((product.revenue / stats.maxProductRevenue) * 100)
                  : 0
              return (
                <div
                  key={product.name}
                  className="space-y-2 rounded-xl border border-border/70 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="text-[12.5px] font-bold">{product.name}</span>
                      <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                        {product.orders} طلب · {product.units} وحدة
                      </p>
                    </div>
                    <div className="text-start">
                      <p className="font-mono text-[12px] font-bold">
                        {formatCurrency(product.revenue)}
                      </p>
                      {product.grossProfit === null ? (
                        <p className="text-[10.5px] font-semibold text-amber-500">التكلفة ناقصة</p>
                      ) : (
                        <p
                          className={`text-[10.5px] font-semibold ${
                            product.grossProfit >= 0 ? 'text-emerald-500' : 'text-red-500'
                          }`}
                        >
                          ربح {formatCurrency(product.grossProfit)} · {product.grossMargin}%
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-[7px] bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percent}%`,
                          background: 'linear-gradient(90deg, #7d1622, #e31e24)',
                          transformOrigin: 'right',
                          animation: 'tfGrow 0.8s ease both',
                        }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-start text-[11px] text-muted-foreground">
                      {percent}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}
