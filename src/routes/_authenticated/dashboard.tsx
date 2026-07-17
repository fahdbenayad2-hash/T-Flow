import { createFileRoute, Link } from '@tanstack/react-router'
import { useOrders } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { RefreshCw, ShoppingCart, CheckCircle, Truck, Clock, TrendingUp, AlertTriangle, Package, ArrowLeft } from 'lucide-react'
import { STATUS_MAP, formatCurrency } from '~/lib/utils'
import { StaggerContainer, StaggerItem, FadeIn } from '~/components/page-transition'
import { ErrorState } from '~/components/empty-state'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="h-4 w-20 bg-muted rounded animate-pulse mb-3" />
              <div className="h-7 w-14 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="p-6"><div className="h-48 bg-muted rounded animate-pulse" /></CardContent></Card>
        <Card><CardContent className="p-6"><div className="h-48 bg-muted rounded animate-pulse" /></CardContent></Card>
      </div>
    </div>
  )
}

function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()

  if (isLoading) return <DashboardSkeleton />

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    )
  }

  const orders = data?.orders || []

  const confirmedOrders = orders.filter((o) =>
    ['تم التسليم', 'مشحون', 'مؤكد'].includes(o['الحالة'])
  )
  const deliveredOrders = orders.filter((o) => o['الحالة'] === 'تم التسليم')
  const pendingOrders = orders.filter((o) =>
    ['قيد المعالجة', 'جاري التجهيز'].includes(o['الحالة'])
  )
  const cancelledOrders = orders.filter((o) => o['الحالة'] === 'ملغي')

  const confirmRate = orders.length > 0
    ? Math.round((confirmedOrders.length / orders.length) * 100)
    : 0
  const deliveryRate = orders.length > 0
    ? Math.round((deliveredOrders.length / orders.length) * 100)
    : 0

  const totalRevenue = orders
    .filter((o) => o['الحالة'] === 'تم التسليم')
    .reduce((sum, o) => sum + (Number(o['السعر']) || 0) * (Number(o['الكمية']) || 1), 0)

  const avgOrderValue = deliveredOrders.length > 0
    ? Math.round(totalRevenue / deliveredOrders.length)
    : 0

  const statusCounts = orders.reduce((acc, o) => {
    const status = o['الحالة']
    if (!acc[status]) acc[status] = 0
    acc[status]++
    return acc
  }, {} as Record<string, number>)

  const kpis = [
    { label: 'إجمالي الطلبات', value: orders.length, icon: ShoppingCart, color: 'text-primary' },
    { label: 'نسبة التأكيد', value: `${confirmRate}%`, icon: CheckCircle, color: 'text-[var(--status-confirmed)]' },
    { label: 'نسبة التسليم', value: `${deliveryRate}%`, icon: Truck, color: 'text-[var(--status-delivered)]' },
    { label: 'معلقة +48 ساعة', value: pendingOrders.length, icon: Clock, color: 'text-destructive', alert: pendingOrders.length > 0 },
    { label: 'الإيرادات', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-[var(--status-delivered)]' },
    { label: 'متوسط الطلب', value: formatCurrency(avgOrderValue), icon: Package, color: 'text-primary' },
    { label: 'مؤكدة', value: confirmedOrders.length, icon: CheckCircle, color: 'text-[var(--status-confirmed)]' },
    { label: 'ملغية', value: cancelledOrders.length, icon: AlertTriangle, color: 'text-[var(--status-cancelled)]' },
  ]

  return (
    <StaggerContainer className="space-y-6">
      <FadeIn>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {kpis.map((kpi) => (
            <StaggerItem key={kpi.label}>
              <Card className={`overflow-hidden transition-all hover:shadow-md ${kpi.alert ? 'border-destructive/50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                    <span className="text-xs text-muted-foreground">{kpi.label}</span>
                  </div>
                  <p className={`text-2xl font-bold font-mono ${kpi.alert ? 'text-destructive' : ''}`}>
                    {kpi.value}
                  </p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FadeIn delay={0.2}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">توزيع الحالات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(statusCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => {
                    const statusInfo = STATUS_MAP[status]
                    const percentage = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <Badge
                          className="text-xs shrink-0 min-w-[70px] justify-center"
                          style={{ backgroundColor: `var(${statusInfo?.var})`, color: '#fff' }}
                        >
                          {status}
                        </Badge>
                        <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: `var(${statusInfo?.var})`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-mono w-12 text-left tabular-nums">
                          {count}
                          <span className="text-muted-foreground text-xs"> ({percentage}%)</span>
                        </span>
                      </div>
                    )
                  })}
                {Object.keys(statusCounts).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد طلبات</p>
                )}
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.3}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">آخر الطلبات</CardTitle>
              <Link to="/orders">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  عرض الكل
                  <ArrowLeft className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {orders.slice(-6).reverse().map((order, i) => (
                  <Link
                    key={order._row}
                    to="/orders/$row"
                    params={{ row: String(order._row) }}
                    className="flex items-center justify-between py-3 border-b last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary font-mono">
                        {String(order._row)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{order['الاسم']}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{order['المنتج']}</p>
                      </div>
                    </div>
                    <div className="text-left flex flex-col items-end gap-1">
                      <Badge
                        className="text-[10px]"
                        style={{
                          backgroundColor: `var(${STATUS_MAP[order['الحالة']]?.var || '--status-processing'})`,
                          color: '#fff',
                        }}
                      >
                        {order['الحالة']}
                      </Badge>
                      <p className="text-xs font-mono text-muted-foreground" dir="ltr">
                        {order['الهاتف']}
                      </p>
                    </div>
                  </Link>
                ))}
                {orders.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">لا توجد طلبات</p>
                )}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {data?.fromCache && (
        <p className="text-xs text-muted-foreground text-center">
          البيانات من الكاش — آخر تحديث: {new Date().toLocaleTimeString('ar-DZ')}
        </p>
      )}
    </StaggerContainer>
  )
}
