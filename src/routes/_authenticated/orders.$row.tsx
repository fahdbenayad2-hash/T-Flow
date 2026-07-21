import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useOrders, useUpdateOrder, useAuditLog } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  ArrowRight, RefreshCw, Save, Clock, User, MapPin, Package,
} from 'lucide-react'
import { STATUS_MAP, STATUS_OPTIONS, formatCurrency } from '~/lib/utils'
import { FadeIn, StaggerContainer, StaggerItem } from '~/components/page-transition'
import { ErrorState } from '~/components/empty-state'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

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
        <Skeleton className="h-10 w-48 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card><CardContent className="p-5"><Skeleton className="h-48 w-full" /></CardContent></Card>
          <Card><CardContent className="p-5"><Skeleton className="h-48 w-full" /></CardContent></Card>
        </div>
        <Card><CardContent className="p-5"><Skeleton className="h-32 w-full" /></CardContent></Card>
      </div>
    )
  }

  if (isError || !order) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'لم يتم العثور على الطلب'}
        onRetry={() => refetch()}
      />
    )
  }

  const handleSave = async () => {
    const updates: Record<string, unknown> = {}
    if (editStatus && editStatus !== order['الحالة']) updates['الحالة'] = editStatus
    if (editNotes && editNotes !== order['الملاحظات']) updates['الملاحظات'] = editNotes

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
    <StaggerContainer className="space-y-4">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.navigate({ to: '/orders' })} className="h-8 w-8">
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h2 className="text-base font-semibold">تفاصيل الطلب</h2>
            <p className="text-xs text-muted-foreground font-mono">{order.order_id}</p>
          </div>
          <Badge
            className="text-xs"
            style={{
              backgroundColor: `var(${statusInfo?.var || '--status-processing'})`,
              color: '#fff',
            }}
          >
            {order['الحالة']}
          </Badge>
        </div>
      </FadeIn>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FadeIn delay={0.1}>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                معلومات العميل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {[
                { label: 'الاسم', value: order['الاسم'] },
                { label: 'الهاتف', value: order['الهاتف'], dir: 'ltr' as const, mono: true },
                { label: 'الولاية', value: order['الولاية'] },
                { label: 'البلدية', value: order['البلدية'] },
                { label: 'العنوان', value: order['العنوان'] },
              ].map((item, i) => (
                <div key={i}>
                  {i > 0 && <Separator />}
                  <div className="flex justify-between py-2.5">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className={`text-sm font-medium ${item.mono ? 'font-mono text-xs' : ''}`} dir={item.dir}>
                      {item.value || '-'}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.15}>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                تفاصيل الطلب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {[
                { label: 'المنتج', value: order['المنتج'] },
                { label: 'اللون', value: order['اللون'] },
                { label: 'المقاس', value: order['المقاس'] },
                {
                  label: 'السعر',
                  value: formatCurrency(Number(order['السعر']) || 0),
                  mono: true, bold: true,
                },
                { label: 'الكمية', value: order['الكمية'] || '1', mono: true },
                { label: 'التوصيل', value: order['نوع التوصيل'] },
                { label: 'التاريخ', value: order['التاريخ'] },
              ].map((item, i) => (
                <div key={i}>
                  {i > 0 && <Separator />}
                  <div className="flex justify-between py-2.5">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className={`text-sm ${item.mono ? 'font-mono text-xs' : ''} ${item.bold ? 'font-bold' : 'font-medium'}`}>
                      {item.value || '-'}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Edit form */}
      <FadeIn delay={0.2}>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm">تعديل الطلب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">الحالة</Label>
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
                <Label className="text-xs">الملاحظات</Label>
                <Input
                  value={editNotes || order['الملاحظات']}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="أضف ملاحظة..."
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-1.5">
                {updateMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                حفظ التعديلات
              </Button>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Audit log */}
      {auditLogs && auditLogs.length > 0 && (
        <FadeIn delay={0.25}>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                سجل التدقيق
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {auditLogs.map((log: any, i: number) => (
                  <div key={log.id} className="relative flex items-start gap-3 py-2.5 border-b last:border-0">
                    <div className="relative mt-1">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      {i < auditLogs.length - 1 && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-px h-full bg-border" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{log.action}</p>
                      {log.new_value && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {JSON.stringify(log.new_value)}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      {new Date(log.created_at).toLocaleString('ar-DZ')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </StaggerContainer>
  )
}
