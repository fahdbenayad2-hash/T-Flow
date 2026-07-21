import { createFileRoute, Link } from '@tanstack/react-router'
import { useOrders } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { AnimatedCounter } from '~/components/ui/animated-counter'
import { Skeleton } from '~/components/ui/skeleton'
import {
  RefreshCw, ShoppingCart, CheckCircle, Truck, Clock, TrendingUp,
  AlertTriangle, Package, ArrowLeft, Activity, Radio,
} from 'lucide-react'
import { STATUS_MAP, formatCurrency } from '~/lib/utils'
import { StaggerContainer, StaggerItem, FadeIn } from '~/components/page-transition'
import { ErrorState } from '~/components/empty-state'
import { useRole, getRoleLabel } from '~/hooks/useRole'
import { motion } from 'framer-motion'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardContent className="p-6"><Skeleton className="h-56 w-full" /></CardContent></Card>
        <Card><CardContent className="p-6"><Skeleton className="h-56 w-full" /></CardContent></Card>
      </div>
    </div>
  )
}

function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const { roles, isAdmin } = useRole()

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
  const noAnswerOrders = orders.filter((o) => o['الحالة'] === 'ما جاوبش')

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
    {
      label: 'إجمالي الطلبات',
      value: orders.length,
      icon: ShoppingCart,
      accent: 'bg-primary',
      trend: null,
    },
    {
      label: 'نسبة التأكيد',
      value: confirmRate,
      suffix: '%',
      icon: CheckCircle,
      accent: 'bg-[var(--status-confirmed)]',
      trend: confirmRate >= 70 ? 'up' : confirmRate >= 40 ? 'neutral' : 'down',
    },
    {
      label: 'نسبة التسليم',
      value: deliveryRate,
      suffix: '%',
      icon: Truck,
      accent: 'bg-[var(--status-delivered)]',
      trend: deliveryRate >= 60 ? 'up' : deliveryRate >= 30 ? 'neutral' : 'down',
    },
    {
      label: 'معلقة',
      value: pendingOrders.length,
      icon: Clock,
      accent: pendingOrders.length > 0 ? 'bg-destructive' : 'bg-muted-foreground/30',
      alert: pendingOrders.length > 0,
    },
  ]

  const secondaryKpis = [
    {
      label: 'الإيرادات',
      value: totalRevenue,
      format: 'currency' as const,
      icon: TrendingUp,
      accent: 'bg-[var(--status-delivered)]',
    },
    {
      label: 'متوسط الطلب',
      value: avgOrderValue,
      format: 'currency' as const,
      icon: Package,
      accent: 'bg-primary',
    },
    {
      label: 'مؤكدة',
      value: confirmedOrders.length,
      icon: CheckCircle,
      accent: 'bg-[var(--status-confirmed)]',
    },
    {
      label: 'ملغية',
      value: cancelledOrders.length,
      icon: AlertTriangle,
      accent: cancelledOrders.length > 0 ? 'bg-[var(--status-cancelled)]' : 'bg-muted-foreground/30',
    },
  ]

  const roleLabel = roles.length > 0 ? getRoleLabel(roles[0]) : 'مستخدم'

  return (
    <StaggerContainer className="space-y-6">
      {/* Hero greeting */}
      <FadeIn>
        <motion.div
          className="relative overflow-hidden rounded-xl bg-gradient-to-l from-primary/10 via-surface-1 to-surface-1 border border-primary/10 p-5 md:p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="absolute inset-0 brand-speedlines pointer-events-none opacity-40" />
          <div className="relative flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg md:text-xl font-bold">
                مرحباً بعودتك
              </h2>
              <p className="text-sm text-muted-foreground">
                إليك نظرة عامة على نشاط اليوم
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="text-xs bg-primary/15 text-primary border-primary/20 gap-1.5">
                <Activity className="h-3 w-3" />
                {roleLabel}
              </Badge>
              {data?.fromCache && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Radio className="h-3 w-3 text-[var(--status-delivered)]" />
                  مباشر
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </FadeIn>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((kpi, i) => (
          <StaggerItem key={kpi.label}>
            <Card className={`overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${kpi.alert ? 'ring-1 ring-destructive/30' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                  <div className={`h-8 w-8 rounded-lg ${kpi.accent}/10 flex items-center justify-center`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.accent.replace('bg-', 'text-')}`} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <AnimatedCounter
                    value={kpi.value}
                    suffix={kpi.suffix || ''}
                    className="text-2xl font-bold"
                  />
                </div>
              </CardContent>
              <div className={`h-[3px] ${kpi.accent}`} />
            </Card>
          </StaggerItem>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {secondaryKpis.map((kpi) => (
          <StaggerItem key={kpi.label}>
            <Card className="overflow-hidden transition-all duration-200 hover:shadow-sm">
              <CardContent className="p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <kpi.icon className={`h-3.5 w-3.5 ${kpi.accent.replace('bg-', 'text-')}`} />
                  <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
                </div>
                <p className="text-lg font-bold font-mono tabular-nums">
                  {kpi.format === 'currency' ? formatCurrency(kpi.value) : kpi.value}
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </div>

      {/* Status distribution + Recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FadeIn delay={0.15}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">توزيع الحالات</CardTitle>
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
                          className="text-[10px] shrink-0 min-w-[70px] justify-center"
                          style={{ backgroundColor: `var(${statusInfo?.var})`, color: '#fff' }}
                        >
                          {status}
                        </Badge>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: `var(${statusInfo?.var})` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
                          />
                        </div>
                        <span className="text-xs font-mono w-16 text-left tabular-nums text-muted-foreground">
                          {count}
                          <span className="text-[10px]"> ({percentage}%)</span>
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

        <FadeIn delay={0.2}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">آخر الطلبات</CardTitle>
              <Link to="/orders">
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                  عرض الكل
                  <ArrowLeft className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {orders.slice(-6).reverse().map((order) => (
                  <Link
                    key={order._row}
                    to="/orders/$row"
                    params={{ row: String(order._row) }}
                    className="flex items-center justify-between py-2.5 -mx-2 px-2 rounded-lg table-row-hover"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary font-mono shrink-0">
                        {String(order._row)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{order['الاسم']}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{order['المنتج']}</p>
                      </div>
                    </div>
                    <div className="text-left flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        className="text-[10px]"
                        style={{
                          backgroundColor: `var(${STATUS_MAP[order['الحالة']]?.var || '--status-processing'})`,
                          color: '#fff',
                        }}
                      >
                        {order['الحالة']}
                      </Badge>
                      <p className="text-[10px] font-mono text-muted-foreground" dir="ltr">
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
        <p className="text-[10px] text-muted-foreground text-center">
          البيانات من الكاش — آخر تحديث: {new Date().toLocaleTimeString('ar-DZ')}
        </p>
      )}
    </StaggerContainer>
  )
}
