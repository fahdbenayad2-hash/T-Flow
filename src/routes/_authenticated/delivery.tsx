import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useOrders } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import {
  Truck,
  Package,
  MapPin,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { STATUS_MAP, formatCurrency } from '~/lib/utils'
import { FadeIn, StaggerContainer, StaggerItem } from '~/components/page-transition'
import { ErrorState, EmptyState } from '~/components/empty-state'

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
  byWilaya: Map<string, { total: number; delivered: number; pending: number; cancelled: number; revenue: number }>
}

function DeliverySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted rounded animate-pulse" /></CardContent></Card>
        ))}
      </div>
      <div className="h-64 bg-muted rounded animate-pulse" />
    </div>
  )
}

function DeliveryPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const orders = data?.orders || []

  const stats = useMemo<DeliveryStats>(() => {
    const byWilaya = new Map<string, { total: number; delivered: number; pending: number; cancelled: number; revenue: number }>()

    let homeDelivery = 0
    let stopDesk = 0
    let delivered = 0
    let pending = 0
    let cancelled = 0

    for (const o of orders) {
      const type = o['نوع التوصيل'] || ''
      if (type.includes('دوميسيل') || type.toLowerCase().includes('home')) homeDelivery++
      else if (type.includes('ستوب') || type.toLowerCase().includes('stop')) stopDesk++

      if (o['الحالة'] === 'تم التسليم') delivered++
      else if (o['الحالة'] === 'ملغي') cancelled++
      else if (['قيد المعالجة', 'جاري التجهيز'].includes(o['الحالة'])) pending++

      const wilaya = String(o['الولاية']) || 'غير معروف'
      const existing = byWilaya.get(wilaya) || { total: 0, delivered: 0, pending: 0, cancelled: 0, revenue: 0 }
      existing.total++
      if (o['الحالة'] === 'تم التسليم') {
        existing.delivered++
        existing.revenue += (Number(o['السعر']) || 0) * (Number(o['الكمية']) || 1)
      } else if (o['الحالة'] === 'ملغي') existing.cancelled++
      else if (['قيد المعالجة', 'جاري التجهيز'].includes(o['الحالة'])) existing.pending++
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
  if (isError) return <ErrorState message={error instanceof Error ? error.message : undefined} onRetry={() => refetch()} />
  if (orders.length === 0) return <EmptyState icon={<Truck className="h-8 w-8 text-muted-foreground" />} title="لا توجد بيانات توصيل" />

  const wilayas = Array.from(stats.byWilaya.entries())
    .sort((a, b) => b[1].total - a[1].total)

  return (
    <StaggerContainer className="space-y-4">
      <FadeIn>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">توصيل دوميسيل</span>
              </div>
              <p className="text-2xl font-bold font-mono">{stats.homeDelivery}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalOrders > 0 ? Math.round((stats.homeDelivery / stats.totalOrders) * 100) : 0}% من الإجمالي
              </p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-[var(--status-shipped)]" />
                <span className="text-xs text-muted-foreground">ستوب ديسك</span>
              </div>
              <p className="text-2xl font-bold font-mono">{stats.stopDesk}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalOrders > 0 ? Math.round((stats.stopDesk / stats.totalOrders) * 100) : 0}% من الإجمالي
              </p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden hover:shadow-md transition-shadow col-span-2 md:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-[var(--status-delivered)]" />
                <span className="text-xs text-muted-foreground">نسبة التسليم</span>
              </div>
              <p className="text-2xl font-bold font-mono text-[var(--status-delivered)]">
                {stats.totalOrders > 0 ? Math.round((stats.delivered / stats.totalOrders) * 100) : 0}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.delivered} مسلّم من {stats.totalOrders}
              </p>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">تم التسليم</p>
                <p className="text-xl font-bold font-mono text-[var(--status-delivered)]">{stats.delivered}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">قيد الانتظار</p>
                <p className="text-xl font-bold font-mono text-[var(--status-processing)]">{stats.pending}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ملغي</p>
                <p className="text-xl font-bold font-mono text-[var(--status-cancelled)]">{stats.cancelled}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.2}>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              التوصيل حسب الولاية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {wilayas.slice(0, 20).map(([wilaya, data]) => {
              const deliveryRate = data.total > 0 ? Math.round((data.delivered / data.total) * 100) : 0
              const isHighRisk = data.cancelled > 0 && (data.cancelled / data.total) > 0.5
              return (
                <div key={wilaya} className="space-y-2 pb-3 border-b last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{wilaya}</span>
                      {isHighRisk && (
                        <Badge className="text-[9px] bg-[var(--status-cancelled)] text-white">
                          <AlertTriangle className="h-3 w-3 ml-0.5" />
                          نسبة إلغاء عالية
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{data.total} طلب</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-[var(--status-delivered)] transition-all duration-500"
                        style={{ width: `${deliveryRate}%` }}
                      />
                      <div
                        className="h-full bg-[var(--status-cancelled)] transition-all duration-500"
                        style={{ width: `${data.total > 0 ? (data.cancelled / data.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs w-20 text-left">{formatCurrency(data.revenue)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="text-[var(--status-delivered)]">✓ {data.delivered}</span>
                    <span className="text-[var(--status-processing)]">⏳ {data.pending}</span>
                    <span className="text-[var(--status-cancelled)]">✗ {data.cancelled}</span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </FadeIn>
    </StaggerContainer>
  )
}
