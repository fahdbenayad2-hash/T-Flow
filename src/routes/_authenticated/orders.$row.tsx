import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useOrders, useUpdateOrder, useAuditLog } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Badge } from '~/components/ui/badge'
import { Skeleton } from '~/components/ui/skeleton'
import { Separator } from '~/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Save,
  Clock,
  User,
  MapPin,
  Package,
  Phone,
} from 'lucide-react'
import { STATUS_MAP, STATUS_OPTIONS, formatCurrency } from '~/lib/utils'
import toast from 'react-hot-toast'

export const Route = createFileRoute('/_authenticated/orders/$row')({
  component: OrderDetailPage,
})

function OrderDetailPage() {
  const { row } = Route.useParams()
  const router = useRouter()
  const { data, isLoading, isError, error, refetch } = useOrders()
  const updateMutation = useUpdateOrder()
  const { data: auditLogs } = useAuditLog(row)

  const order = data?.orders?.find((o) => o._row === Number(row))

  const [editStatus, setEditStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
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

  if (isError || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">لم يتم العثور على الطلب</p>
        <Button onClick={() => router.navigate({ to: '/orders' })} variant="outline">
          <ArrowRight className="h-4 w-4 ml-2" />
          العودة للطلبات
        </Button>
      </div>
    )
  }

  const handleSave = async () => {
    const updates: Record<string, unknown> = {}

    if (editStatus && editStatus !== order['الحالة']) {
      updates['الحالة'] = editStatus
    }
    if (editNotes && editNotes !== order['الملاحظات']) {
      updates['الملاحظات'] = editNotes
    }

    if (Object.keys(updates).length === 0) {
      toast('لا توجد تغييرات', { icon: 'ℹ️' })
      return
    }

    try {
      await updateMutation.mutateAsync({
        row: order._row,
        updates,
        lastModified: order['التاريخ'],
      })
      toast.success('تم تحديث الطلب بنجاح')
      setEditStatus('')
      setEditNotes('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل التحديث')
    }
  }

  const statusInfo = STATUS_MAP[order['الحالة']]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.navigate({ to: '/orders' })}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold">تفاصيل الطلب</h2>
          <p className="text-sm text-muted-foreground font-mono">{order.order_id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              معلومات العميل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الاسم</span>
              <span className="font-medium">{order['الاسم']}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">الهاتف</span>
              <span className="font-mono" dir="ltr">{order['الهاتف']}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">الولاية</span>
              <span>{order['الولاية']}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">البلدية</span>
              <span>{order['البلدية']}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">العنوان</span>
              <span>{order['العنوان']}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              تفاصيل الطلب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">المنتج</span>
              <span className="font-medium">{order['المنتج']}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">اللون</span>
              <span>{order['اللون']}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">المقاس</span>
              <span>{order['المقاس']}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">السعر</span>
              <span className="font-mono font-bold">{formatCurrency(Number(order['السعر']) || 0)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">الكمية</span>
              <span className="font-mono">{order['الكمية'] || '1'}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">التوصيل</span>
              <span>{order['نوع التوصيل'] || '-'}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">الحالة</span>
              <Badge
                style={{
                  backgroundColor: `var(${statusInfo?.var || '--status-processing'})`,
                  color: '#fff',
                }}
              >
                {order['الحالة']}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">تعديل الطلب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={editStatus || order['الحالة']} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الملاحظات</Label>
              <Input
                value={editNotes || order['الملاحظات']}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="أضف ملاحظة..."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 ml-2" />
              )}
              حفظ التعديلات
            </Button>
          </div>
        </CardContent>
      </Card>

      {auditLogs && auditLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              سجل التدقيق
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{log.action}</p>
                    {log.new_value && (
                      <p className="text-xs text-muted-foreground">
                        {JSON.stringify(log.new_value)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(log.created_at).toLocaleString('ar-DZ')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
