import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useOrders } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Skeleton } from '~/components/ui/skeleton'
import { motion } from 'framer-motion'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Package,
  BarChart3,
} from 'lucide-react'
import { STATUS_MAP, formatCurrency } from '~/lib/utils'
import { FadeIn, StaggerContainer, StaggerItem } from '~/components/page-transition'
import { ErrorState, EmptyState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'

export const Route = createFileRoute('/_authenticated/earnings')({
  component: EarningsPage,
})

function EarningsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="skeleton-shimmer rounded-lg h-16 w-full" /></CardContent></Card>
        ))}
      </div>
      <Skeleton className="skeleton-shimmer rounded-lg h-64 w-full" />
    </div>
  )
}

function EarningsPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const [tab, setTab] = useState('overview')

  const orders = data?.orders || []

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o['الحالة'] === 'تم التسليم')
    const cancelled = orders.filter((o) => o['الحالة'] === 'ملغي')
    const pending = orders.filter((o) => ['قيد المعالجة', 'جاري التجهيز'].includes(o['الحالة']))

    const totalRevenue = delivered.reduce(
      (sum, o) => sum + (Number(o['السعر']) || 0) * (Number(o['الكمية']) || 1), 0
    )
    const totalPotentialRevenue = orders.reduce(
      (sum, o) => sum + (Number(o['السعر']) || 0) * (Number(o['الكمية']) || 1), 0
    )
    const lostRevenue = cancelled.reduce(
      (sum, o) => sum + (Number(o['السعر']) || 0) * (Number(o['الكمية']) || 1), 0
    )
    const avgOrderValue = delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0
    const avgDeliveredPerDay = delivered.length > 0

    // Group by date
    const byDate = new Map<string, { revenue: number; orders: number }>()
    for (const o of delivered) {
      const date = o['التاريخ']?.slice(0, 10) || 'غير معروف'
      const existing = byDate.get(date) || { revenue: 0, orders: 0 }
      existing.revenue += (Number(o['السعر']) || 0) * (Number(o['الكمية']) || 1)
      existing.orders++
      byDate.set(date, existing)
    }

    // Group by product
    const byProduct = new Map<string, { revenue: number; orders: number }>()
    for (const o of delivered) {
      const product = o['المنتج'] || 'غير معروف'
      const existing = byProduct.get(product) || { revenue: 0, orders: 0 }
      existing.revenue += (Number(o['السعر']) || 0) * (Number(o['الكمية']) || 1)
      existing.orders++
      byProduct.set(product, existing)
    }

    // Group by wilaya
    const byWilaya = new Map<string, { revenue: number; orders: number }>()
    for (const o of delivered) {
      const wilaya = String(o['الولاية']) || 'غير معروف'
      const existing = byWilaya.get(wilaya) || { revenue: 0, orders: 0 }
      existing.revenue += (Number(o['السعر']) || 0) * (Number(o['الكمية']) || 1)
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
    return <ErrorState message={error instanceof Error ? error.message : undefined} onRetry={() => refetch()} />
  }

  if (orders.length === 0) {
    return <EmptyState icon={<DollarSign className="h-8 w-8 text-muted-foreground" />} title="لا توجد بيانات مالية" />
  }

  return (
    <RoleGuard roles={['admin']}>
    <StaggerContainer className="space-y-4">
      <FadeIn>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="overflow-hidden card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-[var(--status-delivered)]" />
                <span className="text-xs text-muted-foreground">الإيرادات الفعلية</span>
              </div>
              <p className="text-2xl font-bold font-mono text-[var(--status-delivered)]">{formatCurrency(stats.totalRevenue)}</p>
            </CardContent>
            <div className="h-[3px] bg-status-delivered" />
          </Card>
          <Card className="overflow-hidden card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">الإيرادات المحتملة</span>
              </div>
              <p className="text-2xl font-bold font-mono">{formatCurrency(stats.totalPotentialRevenue)}</p>
            </CardContent>
            <div className="h-[3px] bg-primary" />
          </Card>
          <Card className="overflow-hidden card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-[var(--status-cancelled)]" />
                <span className="text-xs text-muted-foreground">الخسائر (ملغي)</span>
              </div>
              <p className="text-2xl font-bold font-mono text-[var(--status-cancelled)]">{formatCurrency(stats.lostRevenue)}</p>
            </CardContent>
            <div className="h-[3px] bg-status-cancelled" />
          </Card>
          <Card className="overflow-hidden card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-[var(--status-processing)]" />
                <span className="text-xs text-muted-foreground">متوسط الطلب</span>
              </div>
              <p className="text-2xl font-bold font-mono">{formatCurrency(stats.avgOrderValue)}</p>
            </CardContent>
            <div className="h-[3px] bg-status-processing" />
          </Card>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">نسبة التحويل</p>
                <p className="text-xl font-bold font-mono">{stats.conversionRate}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">طلبات مسلّمة</p>
                <p className="text-xl font-bold font-mono text-[var(--status-delivered)]">{stats.deliveredCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">طلبات معلّقة</p>
                <p className="text-xl font-bold font-mono text-[var(--status-processing)]">{stats.pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.15}>
        <Tabs value={tab} onValueChange={setTab} dir="rtl">
          <TabsList>
            <TabsTrigger value="overview">حسب المنتج</TabsTrigger>
            <TabsTrigger value="wilaya">حسب الولاية</TabsTrigger>
            <TabsTrigger value="daily">حسب التاريخ</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="text-base">الإيرادات حسب المنتج</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.byProduct.map(([name, data]) => {
                  const percent = stats.totalRevenue > 0 ? Math.round((data.revenue / stats.totalRevenue) * 100) : 0
                  return (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{name}</span>
                        <span className="font-mono text-sm">{formatCurrency(data.revenue)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-[var(--status-delivered)] rounded-full"
                            style={{ width: `${percent}%` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-left">{data.orders} طلب</span>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wilaya" className="mt-4">
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="text-base">الإيرادات حسب الولاية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.byWilaya.slice(0, 15).map(([name, data]) => {
                  const percent = stats.totalRevenue > 0 ? Math.round((data.revenue / stats.totalRevenue) * 100) : 0
                  return (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{name}</span>
                        <span className="font-mono text-sm">{formatCurrency(data.revenue)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${percent}%` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-left">{data.orders} طلب</span>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="daily" className="mt-4">
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="text-base">الإيرادات حسب التاريخ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.byDate.slice(0, 14).map(([date, data]) => {
                  const maxRevenue = stats.byDate.length > 0 ? Math.max(...stats.byDate.map(([, d]) => d.revenue)) : 1
                  const percent = Math.round((data.revenue / maxRevenue) * 100)
                  return (
                    <div key={date} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono" dir="ltr">{date}</span>
                        <span className="font-mono text-sm">{formatCurrency(data.revenue)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-[var(--status-shipped)] rounded-full"
                            style={{ width: `${percent}%` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-left">{data.orders} طلب</span>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </FadeIn>
    </StaggerContainer>
    </RoleGuard>
  )
}
