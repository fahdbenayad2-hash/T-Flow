import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useOrders } from '~/lib/queries'
import { DollarSign } from 'lucide-react'
import { STATUS } from '~/lib/sheet-mapping'
import { formatCurrency } from '~/lib/utils'
import { ErrorState, EmptyState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'

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
  const { data, isLoading, isError, error, refetch } = useOrders()

  const orders = data?.orders || []

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o.status === STATUS.DELIVERED)

    const totalRevenue = delivered.reduce(
      (sum, o) => sum + (Number(o.price) || 0) * (Number(o.quantity) || 1),
      0,
    )
    const avgOrderValue = delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0

    // Monthly trend — last 6 months
    const monthlyMap = new Map<string, { revenue: number; orders: number }>()
    for (const o of delivered) {
      const month = o.date?.slice(0, 7) || 'غير معروف'
      const existing = monthlyMap.get(month) || { revenue: 0, orders: 0 }
      existing.revenue += (Number(o.price) || 0) * (Number(o.quantity) || 1)
      existing.orders++
      monthlyMap.set(month, existing)
    }
    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)

    // By product
    const byProduct = new Map<string, { revenue: number; orders: number }>()
    for (const o of delivered) {
      const product = o.product || 'غير معروف'
      const existing = byProduct.get(product) || { revenue: 0, orders: 0 }
      existing.revenue += (Number(o.price) || 0) * (Number(o.quantity) || 1)
      existing.orders++
      byProduct.set(product, existing)
    }
    const productEntries = Array.from(byProduct.entries()).sort((a, b) => b[1].revenue - a[1].revenue)

    // Monthly growth (compare last month vs previous)
    let monthlyGrowth = 0
    if (monthlyTrend.length >= 2) {
      const last = monthlyTrend[monthlyTrend.length - 1][1].revenue
      const prev = monthlyTrend[monthlyTrend.length - 2][1].revenue
      monthlyGrowth = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0
    }

    return {
      totalRevenue,
      avgOrderValue,
      deliveredCount: delivered.length,
      monthlyGrowth,
      monthlyTrend,
      productEntries,
      maxMonthlyRevenue: monthlyTrend.length > 0 ? Math.max(...monthlyTrend.map(([, d]) => d.revenue)) : 1,
      maxProductRevenue: productEntries.length > 0 ? productEntries[0][1].revenue : 1,
    }
  }, [orders])

  if (isLoading) return <EarningsSkeleton />

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
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
    { label: 'إيرادات صافية', value: formatCurrency(stats.totalRevenue), accent: '#22c55e' },
    { label: 'متوسط طلب', value: formatCurrency(stats.avgOrderValue), accent: '#3b82f6' },
    { label: 'تم التسليم', value: stats.deliveredCount, accent: '#8b5cf6' },
    { label: 'نمو شهر', value: `${stats.monthlyGrowth > 0 ? '+' : ''}${stats.monthlyGrowth}%`, accent: stats.monthlyGrowth >= 0 ? '#22c55e' : '#ef4444' },
  ]

  const monthLabels: Record<string, string> = {
    '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
    '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
    '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر',
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
              <div className="font-mono text-[22px] font-bold mt-1.5 tracking-tight" style={{ color: kpi.accent }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* Bar chart — Monthly revenue trend */}
        <div className="dc-card p-5">
          <h3 className="text-[14.5px] font-extrabold mb-5">الإيرادات الشهرية</h3>
          <div className="flex items-end justify-around gap-3" style={{ height: '180px' }}>
            {stats.monthlyTrend.map(([month, data]) => {
              const heightPercent = stats.maxMonthlyRevenue > 0 ? (data.revenue / stats.maxMonthlyRevenue) * 100 : 0
              const monthPart = month.slice(5, 7)
              const label = monthLabels[monthPart] || monthPart

              return (
                <div key={month} className="flex flex-col items-center gap-2 flex-1">
                  <span className="font-mono text-[10px] text-muted-foreground">{formatCurrency(data.revenue)}</span>
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

        {/* Product breakdown */}
        <div className="dc-card p-5">
          <h3 className="text-[14.5px] font-extrabold mb-4">الإيرادات حسب المنتج</h3>
          <div className="flex flex-col gap-3.5">
            {stats.productEntries.map(([name, data]) => {
              const percent = stats.maxProductRevenue > 0 ? Math.round((data.revenue / stats.maxProductRevenue) * 100) : 0
              return (
                <div key={name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-medium">{name}</span>
                    <span className="font-mono text-[12px] font-bold">{formatCurrency(data.revenue)}</span>
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
                    <span className="text-[11px] text-muted-foreground w-16 text-start shrink-0">{data.orders} طلب</span>
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
