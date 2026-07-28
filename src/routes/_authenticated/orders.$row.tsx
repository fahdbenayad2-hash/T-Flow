import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useOrders, useUpdateOrder, useAuditLog, useDeleteOrder } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '~/components/ui/dialog'
import { ArrowRight, RefreshCw, Save, Clock, User, Package, Trash2 } from 'lucide-react'
import { formatCurrency } from '~/lib/utils'
import { ALL_STATUSES } from '~/lib/sheet-mapping'
import { FadeIn, StaggerContainer } from '~/components/page-transition'
import { ErrorState } from '~/components/empty-state'
import { useRole } from '~/hooks/useRole'
import toast from 'react-hot-toast'
import type { AuditEntry } from '~/lib/types'
import { StatusBadge } from '~/components/status-badge'

export const Route = createFileRoute('/_authenticated/orders/$row')({
  component: OrderDetailPage,
})

function OrderDetailPage() {
  const { row } = Route.useParams()
  const router = useRouter()
  const { data, isLoading, isError, error, refetch } = useOrders()
  const updateMutation = useUpdateOrder()
  const deleteMutation = useDeleteOrder()
  const { data: auditLogs } = useAuditLog(row)
  const { isAdmin } = useRole()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const order = data?.orders?.find((o) => o._row === Number(row))

  const [editStatus, setEditStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="p-5">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
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
    if (editStatus && editStatus !== order.status) updates.status = editStatus
    if (editNotes && editNotes !== order.notes) updates.notes = editNotes

    if (Object.keys(updates).length === 0) {
      toast('لا توجد تغييرات', { icon: 'ℹ️' })
      return
    }

    try {
      await updateMutation.mutateAsync({
        row: order._row,
        updates,
        lastModified: order.lastModified,
        phone: String(order.phone),
        product: order.product,
      })
      toast.success('تم تحديث الطلب بنجاح')
      setEditStatus('')
      setEditNotes('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل التحديث')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({
        row: order._row,
        order_id: order.order_id,
        orderData: order as unknown as Record<string, unknown>,
      })
      toast.success('تم حذف الطلب بنجاح')
      setDeleteDialogOpen(false)
      router.navigate({ to: '/orders' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل الحذف')
    }
  }

  return (
    <StaggerContainer className="space-y-4">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.navigate({ to: '/orders' })}
            className="h-8 w-8"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h2 className="text-base font-semibold">تفاصيل الطلب</h2>
            <p className="text-xs text-muted-foreground font-mono">{order.order_id}</p>
          </div>
          <StatusBadge status={order.status} className="text-xs" />
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
                { label: 'الاسم', value: order.customerName },
                { label: 'الهاتف', value: order.phone, dir: 'ltr' as const, mono: true },
                { label: 'الولاية', value: order.wilaya },
                { label: 'البلدية', value: order.baladiya },
                { label: 'العنوان', value: order.address },
              ].map((item, i) => (
                <div key={i}>
                  {i > 0 && <Separator />}
                  <div className="flex justify-between py-2.5">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span
                      className={`text-sm font-medium ${item.mono ? 'font-mono text-xs' : ''}`}
                      dir={item.dir}
                    >
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
                { label: 'المنتج', value: order.product },
                { label: 'اللون', value: order.color },
                { label: 'المقاس', value: order.size },
                {
                  label: 'السعر',
                  value: formatCurrency(Number(order.price) || 0),
                  mono: true,
                  bold: true,
                },
                { label: 'الكمية', value: order.quantity || '1', mono: true },
                { label: 'التوصيل', value: order.deliveryType },
                { label: 'التاريخ', value: order.date },
              ].map((item, i) => (
                <div key={i}>
                  {i > 0 && <Separator />}
                  <div className="flex justify-between py-2.5">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span
                      className={`text-sm ${item.mono ? 'font-mono text-xs' : ''} ${item.bold ? 'font-bold' : 'font-medium'}`}
                    >
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
                <Select value={editStatus || order.status} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">الملاحظات</Label>
                <Input
                  value={editNotes || order.notes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="أضف ملاحظة..."
                />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف الطلب
                  </Button>
                )}
              </div>
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

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد حذف الطلب</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm py-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الزبون</span>
              <span className="font-medium">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">رقم الطلب</span>
              <span className="font-mono text-xs">{order.order_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الهاتف</span>
              <span className="font-mono text-xs" dir="ltr">{order.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">المنتج</span>
              <span className="font-medium">{order.product}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="gap-1.5"
            >
              {deleteMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                {auditLogs.map((log: AuditEntry, i: number) => (
                  <div
                    key={log.id}
                    className="relative flex items-start gap-3 py-2.5 border-b last:border-0"
                  >
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
