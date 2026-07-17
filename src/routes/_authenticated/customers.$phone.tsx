import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useOrders } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Skeleton } from '~/components/ui/skeleton'
import { Separator } from '~/components/ui/separator'
import {
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Phone,
  ShoppingCart,
  Ban,
  MapPin,
  Clock,
} from 'lucide-react'
import { STATUS_MAP, formatCurrency } from '~/lib/utils'
import type { Order } from '~/lib/types'

export const Route = createFileRoute('/_authenticated/customers/$phone')({
  component: CustomerDetailPage,
})

function CustomerDetailPage() {
  const { phone } = Route.useParams()
  const router = useRouter()
  const { data, isLoading, isError, refetch } = useOrders()

  const orders = data?.orders || []
  const customerOrders = useMemo(
    () => orders.filter((o) => String(o['الهاتف']) === phone),
    [orders, phone]
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (isError || customerOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">لم يتم العثور على العميل</p>
        <Button onClick={() => router.navigate({ to: '/customers' })} variant="outline">
          <ArrowRight className="h-4 w-4 ml-2" />
          العودة للعملاء
        </Button>
      </div>
    )
  }

  const firstOrder = customerOrders[0]
  const totalSpent = customerOrders.reduce(
    (sum, o) => sum + (Number(o['السعر']) || 0) * (Number(o['الكمية']) || 1),
    0
  )
  const cancelledCount = customerOrders.filter((o) => o['الحالة'] === 'ملغي').length
  const noAnswerCount = customerOrders.filter((o) => o['الحالة'] === 'ما جاوبش').length
  const deliveredCount = customerOrders.filter((o) => o['الحالة'] === 'تم التسليم').length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.navigate({ to: '/customers' })}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{firstOrder['الاسم']}</h2>
          <p className="text-sm text-muted-foreground font-mono" dir="ltr">{phone}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">الطلبات</span>
            </div>
            <p className="text-2xl font-bold font-mono">{customerOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">الإنفاق</span>
            </div>
            <p className="text-2xl font-bold font-mono">{formatCurrency(totalSpent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">تم التسليم</span>
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--status-delivered)]">{deliveredCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Ban className="h-4 w-4 text-[var(--status-cancelled)]" />
              <span className="text-xs text-muted-foreground">إلغاء / لا يرد</span>
            </div>
            <p className="text-2xl font-bold font-mono">
              <span className="text-[var(--status-cancelled)]">{cancelledCount}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-[var(--status-no-answer)]">{noAnswerCount}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            العنوان
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {firstOrder['الولاية']} — {firstOrder['البلدية']} — {firstOrder['العنوان']}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">سجل الطلبات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {customerOrders.map((order) => {
              const statusInfo = STATUS_MAP[order['الحالة']]
              return (
                <div key={order._row} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/orders/$row"
                        params={{ row: String(order._row) }}
                        className="text-primary hover:underline text-sm font-medium"
                      >
                        {order.order_id}
                      </Link>
                      <Badge
                        className="text-[10px]"
                        style={{
                          backgroundColor: `var(${statusInfo?.var || '--status-processing'})`,
                          color: '#fff',
                        }}
                      >
                        {order['الحالة']}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{order['المنتج']} — {order['اللون']}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-mono text-sm">{formatCurrency(Number(order['السعر']) || 0)}</p>
                    <p className="text-xs text-muted-foreground">{order['التاريخ'].slice(0, 12)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
