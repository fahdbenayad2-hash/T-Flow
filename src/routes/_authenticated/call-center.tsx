import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useOrders } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Skeleton } from '~/components/ui/skeleton'
import { Label } from '~/components/ui/label'
import { Separator } from '~/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  RefreshCw,
  AlertTriangle,
  Phone,
  PhoneOff,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  MessageSquare,
} from 'lucide-react'
import { formatCurrency } from '~/lib/utils'
import type { Order } from '~/lib/types'
import toast from 'react-hot-toast'

export const Route = createFileRoute('/_authenticated/call-center')({
  component: CallCenterPage,
})

interface CallCardState {
  [orderId: string]: {
    outcome: 'answered' | 'no_answer' | 'postponed' | ''
    note: string
    followUpDate: string
    followUpTime: string
  }
}

function CallCenterPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const [callStates, setCallStates] = useState<CallCardState>({})
  const [activeTab, setActiveTab] = useState('queue')

  const orders = data?.orders || []

  const queueOrders = useMemo(
    () => orders.filter((o) => ['قيد المعالجة', 'جاري التجهيز'].includes(o['الحالة'])),
    [orders]
  )

  const todayStats = useMemo(() => {
    const entries = Object.values(callStates)
    return {
      answered: entries.filter((e) => e.outcome === 'answered').length,
      noAnswer: entries.filter((e) => e.outcome === 'no_answer').length,
      postponed: entries.filter((e) => e.outcome === 'postponed').length,
      total: entries.filter((e) => e.outcome !== '').length,
    }
  }, [callStates])

  const updateCallState = (orderId: string, field: string, value: string) => {
    setCallStates((prev) => ({
      ...prev,
      [orderId]: {
        outcome: '',
        note: '',
        followUpDate: '',
        followUpTime: '',
        ...prev[orderId],
        [field]: value,
      },
    }))
  }

  const handleSubmitCall = (orderId: string) => {
    const state = callStates[orderId]
    if (!state?.outcome) {
      toast.error('اختر نتيجة المكالمة')
      return
    }

    toast.success(
      state.outcome === 'answered' ? 'تم تسجيل الرد' :
      state.outcome === 'no_answer' ? 'تم تسجيل عدم الرد' :
      'تم التأجيل'
    )

    setCallStates((prev) => {
      const next = { ...prev }
      delete next[orderId]
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">فشل تحميل بيانات المكالمات</p>
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">في الطابور</span>
            </div>
            <p className="text-2xl font-bold font-mono">{queueOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-[var(--status-delivered)]" />
              <span className="text-xs text-muted-foreground">ردّ اليوم</span>
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--status-delivered)]">{todayStats.answered}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <PhoneOff className="h-4 w-4 text-[var(--status-no-answer)]" />
              <span className="text-xs text-muted-foreground">ما ردّش</span>
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--status-no-answer)]">{todayStats.noAnswer}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-[var(--status-processing)]" />
              <span className="text-xs text-muted-foreground">مؤجّل</span>
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--status-processing)]">{todayStats.postponed}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="queue">
            الطابور ({queueOrders.length})
          </TabsTrigger>
          <TabsTrigger value="stats">
            الإحصائيات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-3 mt-4">
          {queueOrders.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">لا توجد طلبات في الطابور</p>
                <p className="text-sm text-muted-foreground mt-1">جميع الطلبات تمت معالجتها</p>
              </CardContent>
            </Card>
          ) : (
            queueOrders.map((order) => {
              const state = callStates[order.order_id]
              return (
                <Card key={order._row} className={state?.outcome ? 'border-[var(--status-delivered)]' : ''}>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{order['الاسم']}</h3>
                          <Badge variant="outline" className="text-[10px]">{order['الحالة']}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {order['المنتج']} — {order['اللون']} — {order['المقاس']}
                        </p>
                        <p className="font-mono text-xs" dir="ltr">
                          <Phone className="inline h-3 w-3 ml-1" />
                          {order['الهاتف']}
                        </p>
                        <p className="font-mono text-sm mt-1">{formatCurrency(Number(order['السعر']) || 0)}</p>
                        {order['الملاحظات'] && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <MessageSquare className="inline h-3 w-3 ml-1" />
                            {order['الملاحظات']}
                          </p>
                        )}
                      </div>

                      <div className="w-full md:w-72 space-y-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={state?.outcome === 'answered' ? 'default' : 'outline'}
                            className="flex-1"
                            onClick={() => updateCallState(order.order_id, 'outcome', 'answered')}
                          >
                            <CheckCircle className="h-3.5 w-3.5 ml-1" />
                            ردّ
                          </Button>
                          <Button
                            size="sm"
                            variant={state?.outcome === 'no_answer' ? 'default' : 'outline'}
                            className="flex-1"
                            onClick={() => updateCallState(order.order_id, 'outcome', 'no_answer')}
                          >
                            <PhoneOff className="h-3.5 w-3.5 ml-1" />
                            ما ردّش
                          </Button>
                          <Button
                            size="sm"
                            variant={state?.outcome === 'postponed' ? 'default' : 'outline'}
                            className="flex-1"
                            onClick={() => updateCallState(order.order_id, 'outcome', 'postponed')}
                          >
                            <Clock className="h-3.5 w-3.5 ml-1" />
                            مؤجّل
                          </Button>
                        </div>

                        <Input
                          placeholder="ملاحظة..."
                          value={state?.note || ''}
                          onChange={(e) => updateCallState(order.order_id, 'note', e.target.value)}
                        />

                        {state?.outcome === 'postponed' && (
                          <div className="flex gap-2">
                            <Input
                              type="date"
                              value={state.followUpDate || ''}
                              onChange={(e) => updateCallState(order.order_id, 'followUpDate', e.target.value)}
                            />
                            <Input
                              type="time"
                              value={state.followUpTime || ''}
                              onChange={(e) => updateCallState(order.order_id, 'followUpTime', e.target.value)}
                            />
                          </div>
                        )}

                        {state?.outcome && (
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleSubmitCall(order.order_id)}
                          >
                            تسجيل
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">إحصائيات اليوم</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">إجمالي المكالمات</span>
                  <span className="font-mono font-bold">{todayStats.total}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">نسبة الرد</span>
                  <span className="font-mono font-bold text-[var(--status-delivered)]">
                    {todayStats.total > 0
                      ? Math.round((todayStats.answered / todayStats.total) * 100)
                      : 0}%
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">نسبة عدم الرد</span>
                  <span className="font-mono font-bold text-[var(--status-no-answer)]">
                    {todayStats.total > 0
                      ? Math.round((todayStats.noAnswer / todayStats.total) * 100)
                      : 0}%
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">نسبة التأجيل</span>
                  <span className="font-mono font-bold text-[var(--status-processing)]">
                    {todayStats.total > 0
                      ? Math.round((todayStats.postponed / todayStats.total) * 100)
                      : 0}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">ملخص الطابور</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">طلبات قيد المعالجة</span>
                  <span className="font-mono font-bold">{queueOrders.length}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">إجمالي الطلبات</span>
                  <span className="font-mono font-bold">{orders.length}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">نسبة المعالجة</span>
                  <span className="font-mono font-bold">
                    {orders.length > 0
                      ? Math.round(((orders.length - queueOrders.length) / orders.length) * 100)
                      : 0}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
