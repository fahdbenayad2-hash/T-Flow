import { createFileRoute } from '@tanstack/react-router'
import { useOrders } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { RefreshCw, AlertTriangle, ShoppingCart, CheckCircle, Truck, Clock, Users } from 'lucide-react'
import { STATUS_MAP, formatCurrency } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">فشل تحميل البيانات</p>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'خطأ غير معروف'}
        </p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="h-4 w-4 ml-2" />
          أعد المحاولة
        </Button>
      </div>
    )
  }

  const orders = data?.orders || []
  const today = new Date().toLocaleDateString('ar-DZ')
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('ar-DZ')

  const todayOrders = orders.filter((o) => o['التاريخ'].includes('2026، 16'))
  const yesterdayOrders = orders.filter((o) => o['التاريخ'].includes('2026، 15'))

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

  const agentStats = orders.reduce((acc, o) => {
    const status = o['الحالة']
    if (!acc[status]) acc[status] = 0
    acc[status]++
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">إجمالي الطلبات</span>
            </div>
            <p className="text-2xl font-bold font-mono">{orders.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-[var(--status-delivered)]" />
              <span className="text-xs text-muted-foreground">نسبة التأكيد</span>
            </div>
            <p className="text-2xl font-bold font-mono">{confirmRate}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="h-4 w-4 text-[var(--status-shipped)]" />
              <span className="text-xs text-muted-foreground">نسبة التسليم</span>
            </div>
            <p className="text-2xl font-bold font-mono">{deliveryRate}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-[var(--status-processing)]" />
              <span className="text-xs text-muted-foreground">معلقة +48 ساعة</span>
            </div>
            <p className="text-2xl font-bold font-mono text-destructive">
              {pendingOrders.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">الإيرادات</span>
            </div>
            <p className="text-2xl font-bold font-mono">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">ملغية</span>
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--status-cancelled)]">
              {cancelledOrders.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">مؤكدة</span>
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--status-confirmed)]">
              {confirmedOrders.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">تم التسليم</span>
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--status-delivered)]">
              {deliveredOrders.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">توزيع الحالات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(agentStats).map(([status, count]) => {
                const statusInfo = STATUS_MAP[status]
                const percentage = Math.round((count / orders.length) * 100)
                return (
                  <div key={status} className="flex items-center gap-3">
                    <Badge
                      className="text-xs shrink-0"
                      style={{ backgroundColor: `var(${statusInfo?.var})`, color: '#fff' }}
                    >
                      {status}
                    </Badge>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: `var(${statusInfo?.var})`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-mono w-8 text-left">{count}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">آخر الطلبات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {orders.slice(-5).reverse().map((order) => (
                <div
                  key={order._row}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{order['الاسم']}</p>
                    <p className="text-xs text-muted-foreground">{order['المنتج']}</p>
                  </div>
                  <div className="text-left">
                    <Badge
                      className="text-[10px]"
                      style={{
                        backgroundColor: `var(${STATUS_MAP[order['الحالة']]?.var || '--status-processing'})`,
                        color: '#fff',
                      }}
                    >
                      {order['الحالة']}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {order['الهاتف']}
                    </p>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد طلبات</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {data?.fromCache && (
        <p className="text-xs text-muted-foreground text-center">
          البيانات من الكاش — آخر تحديث: {new Date().toLocaleTimeString('ar-DZ')}
        </p>
      )}
    </div>
  )
}
