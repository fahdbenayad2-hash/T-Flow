import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
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
      <div className="h-9 rounded-[11px] skeleton-shimmer" />
      <div className="h-[300px] rounded-[15px] skeleton-shimmer" />
    </div>
  )
}

function EarningsPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const [tab, setTab] = useState<'product' | 'wilaya' | 'daily'>('product')

  const orders = data?.orders || []

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o.status === STATUS.DELIVERED)
    const cancelled = orders.filter((o) => o.status === STATUS.CANCELLED)
    const pending = orders.filter((o) =>
      ([STATUS.PROCESSING, STATUS.PREPARING] as string[]).includes(o.status),
    )

    const totalRevenue = delivered.reduce(
      (sum, o) => sum + (Number(o.price) || 0) * (Number(o.quantity) || 1),
      0,
    )
    const totalPotentialRevenue = orders.reduce(
      (sum, o) => sum + (Number(o.price) || 0) * (Number(o.quantity) || 1),
      0,
    )
    const lostRevenue = cancelled.reduce(
      (sum, o) => sum + (Number(o.price) || 0) * (Number(o.quantity) || 1),
      0,
    )
    const avgOrderValue = delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0

    const byDate = new Map<string, { revenue: number; orders: number }>()
    for (const o of delivered) {
      const date = o.date?.slice(0, 10) || 'غير معروف'
      const existing = byDate.get(date) || { revenue: 0, orders: 0 }
      existing.revenue += (Number(o.price) || 0) * (Number(o.quantity) || 1)
      existing.orders++
      byDate.set(date, existing)
    }

    const byProduct = new Map<string, { revenue: number; orders: number }>()
    for (const o of delivered) {
      const product = o.product || 'غير معروف'
      const existing = byProduct.get(product) || { revenue: 0, orders: 0 }
      existing.revenue += (Number(o.price) || 0) * (Number(o.quantity) || 1)
      existing.orders++
      byProduct.set(product, existing)
    }

    const byWilaya = new Map<string, { revenue: number; orders: number }>()
    for (const o of delivered) {
      const wilaya = String(o.wilaya) || 'غير معروف'
      const existing = byWilaya.get(wilaya) || { revenue: 0, orders: 0 }
      existing.revenue += (Number(o.price) || 0) * (Number(o.quantity) || 1)
      existing.orders++
      byWilaya.set(wilaya, existing)
    }

    return {
      totalRevenue,
      totalPotentialRevenue,
      lostRevenue,
      avgOrderValue,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      pendingCount: pending.length,
      conversionRate: orders.length > 0 ? Math.round((delivered.length / orders.length) * 100) : 0,
      byDate: Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0])),
      byProduct: Array.from(byProduct.entries()).sort((a, b) => b[1].revenue - a[1].revenue),
      byWilaya: Array.from(byWilaya.entries()).sort((a, b) => b[1].revenue - a[1].revenue),
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
    { label: 'الإيرادات الفعلية', value: formatCurrency(stats.totalRevenue), accent: '#22c55e' },
    { label: 'الإيرادات المحتملة', value: formatCurrency(stats.totalPotentialRevenue), accent: '#e31e24' },
    { label: 'الخسائر (ملغي)', value: formatCurrency(stats.lostRevenue), accent: '#6b7280' },
    { label: 'متوسط الطلب', value: formatCurrency(stats.avgOrderValue), accent: '#f59e0b' },
  ]

  const summaryStats = [
    { label: 'نسبة التحويل', value: `${stats.conversionRate}%` },
    { label: 'طلبات مسلّمة', value: stats.deliveredCount, color: '#22c55e' },
    { label: 'طلبات معلّقة', value: stats.pendingCount, color: '#f59e0b' },
  ]

  const tabs = [
    { key: 'product' as const, label: 'حسب المنتج' },
    { key: 'wilaya' as const, label: 'حسب الولاية' },
    { key: 'daily' as const, label: 'حسب التاريخ' },
  ]

  const renderBarList = (entries: [string, { revenue: number; orders: number }][], maxRevenue: number, barColor: string) => (
    <div className="flex flex-col gap-3.5">
      {entries.map(([name, data]) => {
        const percent = maxRevenue > 0 ? Math.round((data.revenue / maxRevenue) * 100) : 0
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
                    background: barColor,
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
  )

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

        <div className="dc-card-sm p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            {summaryStats.map((item) => (
              <div key={item.label}>
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="font-mono text-[18px] font-bold mt-1" style={item.color ? { color: item.color } : undefined}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="h-9 px-4 rounded-[11px] text-[12px] font-bold transition-all"
              style={{
                background: tab === t.key ? 'var(--color-foreground)' : 'var(--color-card)',
                color: tab === t.key ? 'var(--color-background)' : 'var(--color-muted-foreground)',
                border: '1px solid var(--color-card-border)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="dc-card p-5">
          <h3 className="text-[14.5px] font-extrabold mb-4">
            {tab === 'product' ? 'الإيرادات حسب المنتج' : tab === 'wilaya' ? 'الإيرادات حسب الولاية' : 'الإيرادات حسب التاريخ'}
          </h3>
          {tab === 'product' && renderBarList(stats.byProduct, stats.totalRevenue, '#22c55e')}
          {tab === 'wilaya' && renderBarList(stats.byWilaya.slice(0, 15), stats.totalRevenue, '#e31e24')}
          {tab === 'daily' && renderBarList(
            stats.byDate.slice(0, 14),
            stats.byDate.length > 0 ? Math.max(...stats.byDate.map(([, d]) => d.revenue)) : 1,
            '#8b5cf6',
          )}
        </div>
      </div>
    </RoleGuard>
  )
}
