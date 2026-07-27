import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useOrders } from '~/lib/queries'
import { Truck, AlertTriangle } from 'lucide-react'
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
    {
      total: number
      delivered: number
      pending: number
      cancelled: number
      home: number
      desk: number
      revenue: number
    }
  >
}

function DeliverySkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-[140px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
      <div className="h-[400px] rounded-[15px] skeleton-shimmer" />
    </div>
  )
}

function DeliveryPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const orders = useMemo(() => data?.orders ?? [], [data])

  const stats = useMemo<DeliveryStats>(() => {
    const byWilaya = new Map<
      string,
      {
        total: number
        delivered: number
        pending: number
        cancelled: number
        home: number
        desk: number
        revenue: number
      }
    >()

    let homeDelivery = 0
    let stopDesk = 0
    let delivered = 0
    let pending = 0
    let cancelled = 0

    for (const o of orders) {
      const type = o.deliveryType || ''
      const isHome = type.includes('دوميسيل') || type.toLowerCase().includes('home')
      const isStop = type.includes('ستوب') || type.toLowerCase().includes('stop')
      if (isHome) homeDelivery++
      else if (isStop) stopDesk++

      if (o.status === STATUS.DELIVERED) delivered++
      else if (o.status === STATUS.CANCELLED) cancelled++
      else if (([STATUS.PROCESSING, STATUS.PREPARING] as string[]).includes(o.status)) pending++

      const wilaya = String(o.wilaya) || 'غير معروف'
      const existing = byWilaya.get(wilaya) || {
        total: 0,
        delivered: 0,
        pending: 0,
        cancelled: 0,
        home: 0,
        desk: 0,
        revenue: 0,
      }
      existing.total++
      if (isHome) existing.home++
      else if (isStop) existing.desk++
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
  const homePercent =
    stats.totalOrders > 0 ? Math.round((stats.homeDelivery / stats.totalOrders) * 100) : 0
  const deskPercent =
    stats.totalOrders > 0 ? Math.round((stats.stopDesk / stats.totalOrders) * 100) : 0

  return (
    <RoleGuard roles={['admin', 'shipping_manager']}>
      <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
        {/* Two large delivery-type cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              label: 'توصيل دوميسيل',
              count: stats.homeDelivery,
              percent: homePercent,
              accent: '#e31e24',
            },
            { label: 'ستوب ديسك', count: stats.stopDesk, percent: deskPercent, accent: '#8b5cf6' },
          ].map((item) => (
            <div
              key={item.label}
              className="relative overflow-hidden bg-card p-5 kpi-accent"
              style={{
                border: '1px solid var(--color-card-border)',
                borderRadius: 'var(--color-card-radius)',
                ['--kpi-color' as string]: item.accent,
              }}
            >
              <div className="text-[12.5px] text-muted-foreground font-medium">{item.label}</div>
              <div
                className="font-mono text-[36px] font-bold mt-1.5 tracking-tight"
                style={{ color: item.accent }}
              >
                {item.count}
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-muted-foreground">
                    {item.percent}% من الإجمالي
                  </span>
                </div>
                <div className="h-[6px] bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${item.percent}%`,
                      background: item.accent,
                      transformOrigin: 'right',
                      animation: 'tfGrow 0.8s ease both',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Wilaya table */}
        <div className="dc-card overflow-hidden">
          <div className="p-5 pb-3">
            <h3 className="text-[14.5px] font-extrabold">التوصيل حسب الولاية</h3>
          </div>
          <div
            className="flex items-center text-[11.5px] font-bold text-muted-foreground"
            style={{
              background: 'var(--color-table-header)',
              borderTop: '1px solid var(--color-table-border)',
              borderBottom: '1px solid var(--color-table-border)',
            }}
          >
            <div className="px-4 py-2.5 flex-1 min-w-[100px]">الولاية</div>
            <div className="px-3 py-2.5 w-16 text-center shrink-0">الطلبات</div>
            <div className="px-3 py-2.5 w-24 text-center shrink-0">التوزيع</div>
            <div className="px-3 py-2.5 w-24 text-center shrink-0">الحالة</div>
            <div className="px-3 py-2.5 w-[90px] shrink-0 text-center">الإيرادات</div>
          </div>
          <div className="overflow-auto max-h-[calc(100vh-28rem)]">
            {wilayas.map(([wilaya, data]) => {
              const homeW = data.total > 0 ? (data.home / data.total) * 100 : 0
              const deskW = data.total > 0 ? (data.desk / data.total) * 100 : 0
              const deliveredW = data.total > 0 ? (data.delivered / data.total) * 100 : 0
              const cancelledW = data.total > 0 ? (data.cancelled / data.total) * 100 : 0
              const isHighRisk = data.cancelled > 0 && data.cancelled / data.total > 0.5

              return (
                <div
                  key={wilaya}
                  className="flex items-center text-[12.5px] border-b border-divider last:border-b-0 table-row-hover"
                >
                  <div className="px-4 py-2.5 flex-1 min-w-[100px] font-semibold">
                    <div className="flex items-center gap-1.5">
                      {wilaya}
                      {isHighRisk && (
                        <span className="inline-flex items-center gap-0.5 h-4 px-1.5 rounded-full bg-[var(--status-cancelled)]/15 text-[var(--status-cancelled)] text-[8px] font-bold">
                          <AlertTriangle className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="px-3 py-2.5 w-16 text-center shrink-0 font-mono">
                    {data.total}
                  </div>
                  <div className="px-3 py-2.5 w-24 shrink-0">
                    <div className="h-[7px] bg-muted rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-[#e31e24]"
                        style={{
                          width: `${homeW}%`,
                          animation: 'tfGrow 0.6s ease both',
                          transformOrigin: 'right',
                        }}
                      />
                      <div className="h-full bg-[#8b5cf6]" style={{ width: `${deskW}%` }} />
                    </div>
                  </div>
                  <div className="px-3 py-2.5 w-24 shrink-0">
                    <div className="h-[7px] bg-muted rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-[var(--status-delivered)]"
                        style={{
                          width: `${deliveredW}%`,
                          animation: 'tfGrow 0.6s ease both',
                          transformOrigin: 'right',
                        }}
                      />
                      <div
                        className="h-full bg-[var(--status-cancelled)]"
                        style={{ width: `${cancelledW}%` }}
                      />
                    </div>
                  </div>
                  <div className="px-3 py-2.5 w-[90px] shrink-0 font-mono text-[11px] text-center">
                    {formatCurrency(data.revenue)}
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
