import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useOrders } from '~/lib/queries'
import { Truck, MapPin, AlertTriangle } from 'lucide-react'
import { STATUS } from '~/lib/sheet-mapping'
import { formatCurrency } from '~/lib/utils'
import { ErrorState, EmptyState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'

export const Route = createFileRoute('/_authenticated/delivery')({
  component: DeliveryPage,
})

interface DeliveryStats {
  totalOrders: number
  homeDelivery: number
  stopDesk: number
  delivered: number
  pending: number
  cancelled: number
  byWilaya: Map<
    string,
    { total: number; delivered: number; pending: number; cancelled: number; revenue: number }
  >
}

function DeliverySkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-[110px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
      <div className="h-[400px] rounded-[15px] skeleton-shimmer" />
    </div>
  )
}

function DeliveryPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const orders = data?.orders || []

  const stats = useMemo<DeliveryStats>(() => {
    const byWilaya = new Map<
      string,
      { total: number; delivered: number; pending: number; cancelled: number; revenue: number }
    >()

    let homeDelivery = 0
    let stopDesk = 0
    let delivered = 0
    let pending = 0
    let cancelled = 0

    for (const o of orders) {
      const type = o.deliveryType || ''
      if (type.includes('دوميسيل') || type.toLowerCase().includes('home')) homeDelivery++
      else if (type.includes('ستوب') || type.toLowerCase().includes('stop')) stopDesk++

      if (o.status === STATUS.DELIVERED) delivered++
      else if (o.status === STATUS.CANCELLED) cancelled++
      else if (([STATUS.PROCESSING, STATUS.PREPARING] as string[]).includes(o.status)) pending++

      const wilaya = String(o.wilaya) || 'غير معروف'
      const existing = byWilaya.get(wilaya) || {
        total: 0,
        delivered: 0,
        pending: 0,
        cancelled: 0,
        revenue: 0,
      }
      existing.total++
      if (o.status === STATUS.DELIVERED) {
        existing.delivered++
        existing.revenue += (Number(o.price) || 0) * (Number(o.quantity) || 1)
      } else if (o.status === STATUS.CANCELLED) existing.cancelled++
      else if (([STATUS.PROCESSING, STATUS.PREPARING] as string[]).includes(o.status))
        existing.pending++
      byWilaya.set(wilaya, existing)
    }

    return {
      totalOrders: orders.length,
      homeDelivery,
      stopDesk,
      delivered,
      pending,
      cancelled,
      byWilaya,
    }
  }, [orders])

  if (isLoading) return <DeliverySkeleton />
  if (isError)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    )
  if (orders.length === 0)
    return (
      <EmptyState
        icon={<Truck className="h-8 w-8 text-muted-foreground" />}
        title="لا توجد بيانات توصيل"
      />
    )

  const wilayas = Array.from(stats.byWilaya.entries()).sort((a, b) => b[1].total - a[1].total)
  const deliveryRate = stats.totalOrders > 0 ? Math.round((stats.delivered / stats.totalOrders) * 100) : 0

  const kpis = [
    {
      label: 'توصيل دوميسيل',
      value: stats.homeDelivery,
      sub: `${stats.totalOrders > 0 ? Math.round((stats.homeDelivery / stats.totalOrders) * 100) : 0}% من الإجمالي`,
      accent: '#e31e24',
    },
    {
      label: 'ستوب ديسك',
      value: stats.stopDesk,
      sub: `${stats.totalOrders > 0 ? Math.round((stats.stopDesk / stats.totalOrders) * 100) : 0}% من الإجمالي`,
      accent: '#8b5cf6',
    },
    {
      label: 'نسبة التسليم',
      value: `${deliveryRate}%`,
      sub: `${stats.delivered} مسلّم من ${stats.totalOrders}`,
      accent: '#22c55e',
    },
  ]

  const summaryStats = [
    { label: 'تم التسليم', value: stats.delivered, color: '#22c55e' },
    { label: 'قيد الانتظار', value: stats.pending, color: '#f59e0b' },
    { label: 'ملغي', value: stats.cancelled, color: '#6b7280' },
  ]

  return (
    <RoleGuard roles={['admin', 'shipping_manager']}>
      <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
              <div className="font-mono text-[30px] font-bold mt-1.5 tracking-tight" style={{ color: kpi.accent }}>
                {kpi.value}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>

        <div className="dc-card-sm p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            {summaryStats.map((item) => (
              <div key={item.label}>
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="font-mono text-[18px] font-bold mt-1" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="dc-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[14.5px] font-extrabold">التوصيل حسب الولاية</h3>
          </div>
          <div className="flex flex-col gap-3.5">
            {wilayas.slice(0, 20).map(([wilaya, data]) => {
              const rate = data.total > 0 ? Math.round((data.delivered / data.total) * 100) : 0
              const isHighRisk = data.cancelled > 0 && data.cancelled / data.total > 0.5
              return (
                <div key={wilaya} className="space-y-2 pb-3 border-b border-divider last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold">{wilaya}</span>
                      {isHighRisk && (
                        <span className="inline-flex items-center gap-0.5 h-5 px-2 rounded-full bg-[var(--status-cancelled)]/15 text-[var(--status-cancelled)] text-[9px] font-bold">
                          <AlertTriangle className="h-3 w-3" />
                          نسبة إلغاء عالية
                        </span>
                      )}
                    </div>
                    <span className="text-[11.5px] text-muted-foreground">{data.total} طلب</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-[9px] bg-muted rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-[var(--status-delivered)]"
                        style={{ width: `${rate}%`, transformOrigin: 'right', animation: 'tfGrow 0.6s ease both' }}
                      />
                      <div
                        className="h-full bg-[var(--status-cancelled)]"
                        style={{ width: `${data.total > 0 ? (data.cancelled / data.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] w-20 text-start shrink-0">{formatCurrency(data.revenue)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span style={{ color: '#22c55e' }}>✓ {data.delivered}</span>
                    <span style={{ color: '#f59e0b' }}>⏳ {data.pending}</span>
                    <span style={{ color: '#6b7280' }}>✗ {data.cancelled}</span>
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
