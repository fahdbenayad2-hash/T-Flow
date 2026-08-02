import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Loader2,
  MapPin,
  PackageCheck,
  Printer,
  Search,
  Send,
  TestTubeDiagonal,
  Truck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState, ErrorState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import {
  buildDeliveryItems,
  getDeliveryStats,
  type DeliveryItem,
  type DeliveryStage,
} from '~/lib/delivery-operations'
import {
  buildShipmentCsv,
  DELIVERY_CARRIERS,
  type DeliveryShipmentAssignment,
} from '~/lib/delivery-shipment'
import { TEST_DELIVERY_CARRIER, type SimulationOutcome } from '~/lib/delivery-simulator'
import {
  useBulkUpdateOrders,
  useCreateDeliveryBatch,
  useDeliveryShipments,
  useOrders,
  useSimulateDeliveryShipments,
} from '~/lib/queries'
import { STATUS } from '~/lib/sheet-mapping'
import { cn, formatCurrency } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/delivery')({
  component: DeliveryPage,
})

type DeliveryFilter = 'all' | DeliveryStage

const STAGE_META: Record<DeliveryStage, { label: string; className: string; icon: typeof Truck }> =
  {
    ready: {
      label: 'جاهز للشحن',
      className: 'border-sky-500/20 bg-sky-500/10 text-sky-500',
      icon: PackageCheck,
    },
    in_transit: {
      label: 'قيد النقل',
      className: 'border-violet-500/20 bg-violet-500/10 text-violet-500',
      icon: Truck,
    },
    delivered: {
      label: 'تم التسليم',
      className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
      icon: CheckCircle2,
    },
    exception: {
      label: 'استثناء',
      className: 'border-red-500/20 bg-red-500/10 text-red-500',
      icon: AlertTriangle,
    },
  }

function DeliverySkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-[105px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
      <div className="h-52 rounded-[15px] skeleton-shimmer" />
      {[...Array(3)].map((_, index) => (
        <div key={index} className="h-[130px] rounded-[15px] skeleton-shimmer" />
      ))}
    </div>
  )
}

function ShipmentLabel({
  item,
  shipment,
}: {
  item: DeliveryItem
  shipment?: DeliveryShipmentAssignment
}) {
  const { order } = item
  return (
    <article className="shipment-print-label rounded-2xl border-2 border-foreground bg-white p-5 text-black">
      <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <div className="text-2xl font-black tracking-tight">
            <span className="text-[#e31e24]">T-</span>Flow
          </div>
          <p className="text-[10px] font-bold tracking-[0.2em] text-gray-500">
            FAST · SMART · DELIVERED
          </p>
        </div>
        <div className="text-left">
          <p className="text-[10px] font-bold text-gray-500">مرجع الشحنة</p>
          <p className="font-mono text-lg font-black">{order.order_id}</p>
          {shipment && (
            <>
              <p className="mt-1 text-[10px] font-bold">{shipment.carrier}</p>
              <p className="font-mono text-[10px]">{shipment.batchReference}</p>
              <p className="font-mono text-[11px] font-bold">{shipment.trackingNumber}</p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-black py-4">
        <div>
          <p className="text-[10px] font-bold text-gray-500">المستلم</p>
          <p className="mt-1 text-lg font-black">{order.customerName}</p>
          <p dir="ltr" className="mt-1 text-right font-mono text-base font-bold">
            {order.phone}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-500">الوجهة</p>
          <p className="mt-1 text-base font-black">
            {order.wilaya} — {order.baladiya}
          </p>
          <p className="mt-1 text-xs leading-5">{order.address || 'العنوان غير محدد'}</p>
        </div>
      </div>

      <div className="border-b border-black py-4">
        <p className="text-[10px] font-bold text-gray-500">محتوى الطلب</p>
        <p className="mt-1 text-base font-black">{order.product}</p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold">
          <span>الكمية: {order.quantity || 1}</span>
          {order.color && <span>اللون: {order.color}</span>}
          {order.size && <span>المقاس: {order.size}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 items-end gap-4 pt-4">
        <div>
          <p className="text-[10px] font-bold text-gray-500">نوع التوصيل</p>
          <p className="mt-1 text-sm font-black">{order.deliveryType || 'غير محدد'}</p>
          {order.notes && (
            <>
              <p className="mt-3 text-[10px] font-bold text-gray-500">ملاحظة</p>
              <p className="mt-1 text-xs">{order.notes}</p>
            </>
          )}
        </div>
        <div className="rounded-xl border-2 border-black p-3 text-center">
          <p className="text-[10px] font-bold">المبلغ عند التسليم</p>
          <p className="mt-1 font-mono text-2xl font-black">{formatCurrency(item.amount)}</p>
        </div>
      </div>
    </article>
  )
}

function DeliveryPage() {
  const ordersQuery = useOrders()
  const shipmentsQuery = useDeliveryShipments()
  const createBatch = useCreateDeliveryBatch()
  const simulateShipments = useSimulateDeliveryShipments()
  const bulkUpdate = useBulkUpdateOrders()
  const [filter, setFilter] = useState<DeliveryFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [simulationDialogOpen, setSimulationDialogOpen] = useState(false)
  const [carrier, setCarrier] = useState<(typeof DELIVERY_CARRIERS)[number]>(TEST_DELIVERY_CARRIER)
  const [customCarrier, setCustomCarrier] = useState('')
  const [batchNotes, setBatchNotes] = useState('')

  const orders = useMemo(() => ordersQuery.data?.orders ?? [], [ordersQuery.data])
  const baseItems = useMemo(() => buildDeliveryItems(orders), [orders])
  const shipments = useMemo(() => shipmentsQuery.data ?? [], [shipmentsQuery.data])
  const shipmentsBySource = useMemo(
    () => new Map(shipments.map((shipment) => [shipment.sourceOrderId, shipment])),
    [shipments],
  )
  const shipmentsByRow = useMemo(
    () =>
      new Map(
        shipments
          .filter((shipment) => shipment.sheetRow)
          .map((shipment) => [shipment.sheetRow, shipment]),
      ),
    [shipments],
  )

  const items = useMemo(
    () =>
      baseItems.map((item) => {
        const shipment =
          shipmentsBySource.get(item.order._sourceOrderId || item.order.order_id) ||
          shipmentsByRow.get(item.order._row)
        return shipment ? { ...item, stage: shipment.status } : item
      }),
    [baseItems, shipmentsByRow, shipmentsBySource],
  )
  const stats = useMemo(() => getDeliveryStats(items), [items])

  const shipmentFor = (item: DeliveryItem) =>
    shipmentsBySource.get(item.order._sourceOrderId || item.order.order_id) ||
    shipmentsByRow.get(item.order._row)

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchesFilter = filter === 'all' || item.stage === filter
      const matchesSearch =
        !query ||
        item.order.customerName.toLowerCase().includes(query) ||
        String(item.order.phone).includes(query) ||
        item.order.order_id.toLowerCase().includes(query) ||
        String(item.order.wilaya).toLowerCase().includes(query)
      return matchesFilter && matchesSearch
    })
  }, [filter, items, search])

  const selectableItems = filteredItems
  const selectedItems = items.filter((item) => selectedRows.has(item.order._row))
  const selectedTestShipments = selectedItems
    .map((item) => shipmentFor(item))
    .filter((shipment): shipment is DeliveryShipmentAssignment =>
      Boolean(shipment && shipment.carrier === TEST_DELIVERY_CARRIER),
    )
  const allVisibleSelected =
    selectableItems.length > 0 && selectableItems.every((item) => selectedRows.has(item.order._row))

  const toggleRow = (row: number, checked: boolean) => {
    setSelectedRows((current) => {
      const next = new Set(current)
      if (checked) next.add(row)
      else next.delete(row)
      return next
    })
  }

  const toggleVisible = (checked: boolean) => {
    setSelectedRows((current) => {
      const next = new Set(current)
      for (const item of selectableItems) {
        if (checked) next.add(item.order._row)
        else next.delete(item.order._row)
      }
      return next
    })
  }

  const updateSelectedStatus = async (status: string) => {
    if (selectedItems.length === 0) {
      toast.error('حدد طلبًا واحدًا على الأقل')
      return
    }

    try {
      await bulkUpdate.mutateAsync(
        selectedItems.map(({ order }) => ({
          row: order._row,
          order_id: order._sourceOrderId || order.order_id,
          phone: String(order.phone),
          product: order.product,
          updates: { status },
        })),
      )
      toast.success(`تم تحديث ${selectedItems.length} طلب`)
      setSelectedRows(new Set())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تحديث الشحنات')
    }
  }

  const openPrintPreview = () => {
    if (selectedItems.length === 0) {
      toast.error('حدد طلبًا واحدًا على الأقل لطباعة الملصقات')
      return
    }
    setPrintDialogOpen(true)
  }

  const handleCreateBatch = async () => {
    const resolvedCarrier = carrier === 'شركة أخرى' ? customCarrier.trim() : carrier
    if (!resolvedCarrier) {
      toast.error('اكتب اسم شركة التوصيل')
      return
    }
    try {
      const result = await createBatch.mutateAsync({
        carrier: resolvedCarrier,
        notes: batchNotes,
        orders: selectedItems.map(({ order }) => ({
          sourceOrderId: order._sourceOrderId || order.order_id,
          sheetRow: order._row,
        })),
      })
      toast.success(`تم إنشاء الدفعة ${result.reference} وربط ${result.count} شحنة`)
      setAssignDialogOpen(false)
      setBatchNotes('')
      setSelectedRows(new Set())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر إنشاء دفعة الشحن')
    }
  }

  const openSimulation = () => {
    if (!selectedItems.length) {
      toast.error('حدد شحنة واحدة على الأقل')
      return
    }
    if (selectedTestShipments.length !== selectedItems.length) {
      toast.error(`المحاكاة تعمل فقط مع ${TEST_DELIVERY_CARRIER}`)
      return
    }
    if (
      selectedTestShipments.some(
        (shipment) => shipment.status === 'delivered' || shipment.status === 'exception',
      )
    ) {
      toast.error('ألغ تحديد الشحنات التي وصلت إلى حالة نهائية')
      return
    }
    setSimulationDialogOpen(true)
  }

  const handleSimulation = async (outcome: SimulationOutcome) => {
    try {
      const transitions = await simulateShipments.mutateAsync({
        shipmentIds: selectedTestShipments.map((shipment) => shipment.id),
        outcome,
      })
      const statusByShipment = new Map(
        transitions.map((transition) => [transition.shipmentId, transition.status]),
      )
      await bulkUpdate.mutateAsync(
        selectedItems.map(({ order }) => {
          const shipment =
            shipmentsBySource.get(order._sourceOrderId || order.order_id) ||
            shipmentsByRow.get(order._row)
          const simulatedStatus = shipment ? statusByShipment.get(shipment.id) : undefined
          const status =
            simulatedStatus === 'delivered'
              ? STATUS.DELIVERED
              : simulatedStatus === 'exception'
                ? STATUS.CANCELLED
                : STATUS.SHIPPED
          return {
            row: order._row,
            order_id: order._sourceOrderId || order.order_id,
            phone: String(order.phone),
            product: order.product,
            updates: { status },
          }
        }),
      )
      toast.success(
        outcome === 'exception'
          ? `تم تسجيل استثناء لـ ${transitions.length} شحنة تجريبية`
          : `تم تحريك ${transitions.length} شحنة إلى المرحلة التالية`,
      )
      setSimulationDialogOpen(false)
      setSelectedRows(new Set())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تشغيل المحاكاة')
    }
  }

  const exportSelectedShipments = () => {
    if (!selectedItems.length) {
      toast.error('حدد طلباً واحداً على الأقل للتصدير')
      return
    }
    const csv = buildShipmentCsv(
      selectedItems.map((item) => ({ order: item.order, shipment: shipmentFor(item) })),
    )
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `tflow-shipments-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (ordersQuery.isLoading) return <DeliverySkeleton />

  if (ordersQuery.isError) {
    return (
      <ErrorState
        message={ordersQuery.error instanceof Error ? ordersQuery.error.message : undefined}
        onRetry={() => ordersQuery.refetch()}
      />
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Truck className="h-8 w-8 text-muted-foreground" />}
        title="لا توجد شحنات جاهزة"
      />
    )
  }

  const stageCounts: Record<DeliveryFilter, number> = {
    all: items.length,
    ready: stats.ready,
    in_transit: stats.inTransit,
    delivered: stats.delivered,
    exception: stats.exceptions,
  }

  const filters: Array<{ value: DeliveryFilter; label: string }> = [
    { value: 'all', label: 'الكل' },
    { value: 'ready', label: 'جاهز' },
    { value: 'in_transit', label: 'قيد النقل' },
    { value: 'delivered', label: 'مسلّم' },
    { value: 'exception', label: 'استثناء' },
  ]

  const wilayaStats = Array.from(
    items.reduce((map, item) => {
      const wilaya = String(item.order.wilaya) || 'غير معروف'
      const current = map.get(wilaya) || { total: 0, delivered: 0, amount: 0 }
      current.total += 1
      if (item.stage === 'delivered') current.delivered += 1
      current.amount += item.amount
      map.set(wilaya, current)
      return map
    }, new Map<string, { total: number; delivered: number; amount: number }>()),
  )
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)

  return (
    <RoleGuard roles={['admin', 'shipping_manager']}>
      <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: 'جاهزة للشحن', value: stats.ready, icon: PackageCheck, color: 'text-sky-500' },
            { label: 'قيد النقل', value: stats.inTransit, icon: Truck, color: 'text-violet-500' },
            {
              label: 'تم التسليم',
              value: stats.delivered,
              icon: CheckCircle2,
              color: 'text-emerald-500',
            },
            {
              label: 'مبالغ قيد التحصيل',
              value: formatCurrency(stats.collectableAmount),
              icon: ClipboardCheck,
              color: 'text-amber-500',
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="relative overflow-hidden bg-card p-4 md:p-[18px]"
              style={{
                border: '1px solid var(--color-card-border)',
                borderRadius: 'var(--color-card-radius)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-mono text-[22px] md:text-[30px] font-bold tracking-tight">
                  {kpi.value}
                </div>
                <div className="rounded-xl bg-muted p-2">
                  <kpi.icon className={cn('h-4 w-4', kpi.color)} />
                </div>
              </div>
              <div className="text-[11.5px] md:text-[12.5px] text-muted-foreground font-medium mt-1">
                {kpi.label}
              </div>
            </div>
          ))}
        </div>

        <div className="dc-card overflow-hidden">
          <div className="p-4 md:p-5 border-b border-border/70">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-extrabold">مركز تجهيز الشحنات</h3>
                  {selectedItems.length > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {selectedItems.length} محدد
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-muted-foreground mt-1">
                  حدّث الحالات واطبع الملصقات دون مغادرة الصفحة
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setAssignDialogOpen(true)}
                  disabled={selectedItems.length === 0 || createBatch.isPending}
                  className="h-9 rounded-xl"
                >
                  <Truck className="h-4 w-4" />
                  إسناد شركة التوصيل
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={openSimulation}
                  disabled={selectedItems.length === 0 || simulateShipments.isPending}
                  className="h-9 rounded-xl border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/10"
                >
                  {simulateShipments.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTubeDiagonal className="h-4 w-4" />
                  )}
                  محاكي التوصيل
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={exportSelectedShipments}
                  disabled={selectedItems.length === 0}
                  className="h-9 rounded-xl"
                >
                  <Download className="h-4 w-4" />
                  تصدير CSV
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={openPrintPreview}
                  disabled={selectedItems.length === 0}
                  className="h-9 rounded-xl"
                >
                  <Printer className="h-4 w-4" />
                  طباعة الملصقات
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => updateSelectedStatus(STATUS.PREPARING)}
                  disabled={selectedItems.length === 0 || bulkUpdate.isPending}
                  className="h-9 rounded-xl"
                >
                  <PackageCheck className="h-4 w-4" />
                  جاري التجهيز
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => updateSelectedStatus(STATUS.SHIPPED)}
                  disabled={selectedItems.length === 0 || bulkUpdate.isPending}
                  className="h-9 rounded-xl"
                >
                  {bulkUpdate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  تم الشحن
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => updateSelectedStatus(STATUS.DELIVERED)}
                  disabled={selectedItems.length === 0 || bulkUpdate.isPending}
                  className="h-9 rounded-xl border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  تم التسليم
                </Button>
              </div>
            </div>

            <div className="relative mt-4">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم، الهاتف، الولاية أو رقم الطلب..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 ps-10 rounded-xl bg-muted/35"
              />
            </div>

            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-colors',
                    filter === item.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                  <span className="font-mono text-[10px] opacity-75">
                    {stageCounts[item.value]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 border-b border-border/70 bg-muted/20 px-4 py-2.5">
            <Checkbox
              aria-label="تحديد كل الشحنات الظاهرة"
              checked={allVisibleSelected}
              onCheckedChange={(checked) => toggleVisible(checked === true)}
              disabled={selectableItems.length === 0}
            />
            <span className="text-[11px] font-bold text-muted-foreground">
              تحديد كل الشحنات الظاهرة ({selectableItems.length})
            </span>
          </div>

          <div className="p-3 md:p-4">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="rounded-2xl bg-muted p-5 mb-4">
                  <Search className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">لا توجد شحنات مطابقة</h3>
                <p className="text-sm text-muted-foreground mt-1">جرّب تغيير البحث أو الحالة</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredItems.map((item) => {
                  const { order } = item
                  const shipment = shipmentFor(item)
                  const stage = STAGE_META[item.stage]
                  const StageIcon = stage.icon
                  return (
                    <div
                      key={order.order_id}
                      className={cn(
                        'flex flex-col gap-3 rounded-2xl border p-3 transition-colors md:flex-row md:items-center',
                        selectedRows.has(order._row)
                          ? 'border-primary/35 bg-primary/[0.035]'
                          : 'border-transparent hover:border-border hover:bg-muted/20',
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Checkbox
                          aria-label={`تحديد الطلب ${order.order_id}`}
                          checked={selectedRows.has(order._row)}
                          onCheckedChange={(checked) => toggleRow(order._row, checked === true)}
                        />
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <StageIcon className={cn('h-5 w-5', stage.className.split(' ').at(-1))} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10.5px] font-bold text-primary">
                              {order.order_id}
                            </span>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold',
                                stage.className,
                              )}
                            >
                              {stage.label}
                            </span>
                          </div>
                          <h4 className="mt-1 truncate text-[13.5px] font-extrabold">
                            {order.customerName}
                          </h4>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
                            <span dir="ltr" className="font-mono">
                              {order.phone}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {order.wilaya}، {order.baladiya}
                            </span>
                            <span>{item.isHomeDelivery ? 'منزل' : 'مكتب'}</span>
                            {shipment && (
                              <span className="font-semibold text-primary">
                                {shipment.carrier} · {shipment.trackingNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 md:flex md:items-center md:gap-6">
                        <div>
                          <p className="text-[9.5px] text-muted-foreground">المنتج</p>
                          <p className="mt-1 max-w-32 truncate text-[11px] font-bold">
                            {order.product}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9.5px] text-muted-foreground">المبلغ</p>
                          <p className="mt-1 font-mono text-[11px] font-bold">
                            {formatCurrency(item.amount)}
                          </p>
                        </div>
                        <Link
                          to="/orders/$row"
                          params={{ row: String(order._row) }}
                          className="self-center justify-self-end rounded-xl border border-border px-3 py-2 text-[10.5px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          التفاصيل
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="dc-card overflow-hidden">
          <div className="p-4 md:p-5 border-b border-border/70">
            <h3 className="text-[14px] font-extrabold">أداء التوصيل حسب الولاية</h3>
            <p className="text-[11.5px] text-muted-foreground mt-1">أكثر الولايات نشاطًا</p>
          </div>
          <div className="divide-y divide-border/70">
            {wilayaStats.map(([wilaya, data]) => {
              const deliveryRate =
                data.total > 0 ? Math.round((data.delivered / data.total) * 100) : 0
              return (
                <div
                  key={wilaya}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 text-[11.5px] md:px-5"
                >
                  <div>
                    <p className="font-bold">{wilaya}</p>
                    <div className="mt-2 h-1.5 max-w-64 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${deliveryRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-mono font-bold">{data.total}</p>
                    <p className="text-[9px] text-muted-foreground">شحنة</p>
                  </div>
                  <div className="text-left">
                    <p className="font-mono font-bold">{deliveryRate}%</p>
                    <p className="text-[9px] text-muted-foreground">تسليم</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" dir="rtl">
          <div className="shipment-print-hide">
            <DialogHeader>
              <DialogTitle>معاينة ملصقات الشحن</DialogTitle>
              <DialogDescription>سيتم طباعة ملصق مستقل لكل طلب محدد بقياس A6.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="shipment-print-root space-y-4 bg-muted/25 p-2">
            {selectedItems.map((item) => (
              <ShipmentLabel key={item.order.order_id} item={item} shipment={shipmentFor(item)} />
            ))}
          </div>

          <DialogFooter className="shipment-print-hide">
            <Button type="button" variant="outline" onClick={() => setPrintDialogOpen(false)}>
              إغلاق
            </Button>
            <Button type="button" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              طباعة {selectedItems.length} ملصق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>إنشاء دفعة شحن</DialogTitle>
            <DialogDescription>
              سيتم ربط {selectedItems.length} طلب بشركة التوصيل وإنشاء رقم تتبع داخلي لكل شحنة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <label className="block space-y-1.5 text-[12px] font-bold">
              شركة التوصيل
              <select
                value={carrier}
                onChange={(event) =>
                  setCarrier(event.target.value as (typeof DELIVERY_CARRIERS)[number])
                }
                className="h-10 w-full rounded-[10px] border border-input bg-background px-3 text-[12px]"
              >
                {DELIVERY_CARRIERS.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </label>

            {carrier === 'شركة أخرى' && (
              <label className="block space-y-1.5 text-[12px] font-bold">
                اسم الشركة
                <Input
                  value={customCarrier}
                  onChange={(event) => setCustomCarrier(event.target.value)}
                  placeholder="اكتب اسم شركة التوصيل"
                />
              </label>
            )}

            <label className="block space-y-1.5 text-[12px] font-bold">
              ملاحظة الدفعة
              <Input
                value={batchNotes}
                onChange={(event) => setBatchNotes(event.target.value)}
                placeholder="اختياري: اسم السائق أو نقطة التجميع"
              />
            </label>

            {carrier === TEST_DELIVERY_CARRIER && (
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-[11.5px] text-cyan-600 dark:text-cyan-300">
                هذا اتصال تجريبي داخلي. لا يرسل أي بيانات إلى شركة خارجية ويمكنك تغيير حالته من زر
                محاكي التوصيل.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3 text-[11px]">
              <div>
                <p className="text-muted-foreground">عدد الشحنات</p>
                <p className="mt-1 font-mono text-lg font-bold">{selectedItems.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">مبلغ التحصيل</p>
                <p className="mt-1 font-mono text-lg font-bold">
                  {formatCurrency(selectedItems.reduce((sum, item) => sum + item.amount, 0))}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreateBatch} disabled={createBatch.isPending}>
              {createBatch.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Truck className="h-4 w-4" />
              )}
              إنشاء الدفعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={simulationDialogOpen} onOpenChange={setSimulationDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>محاكي شركة التوصيل</DialogTitle>
            <DialogDescription>
              اختبر دورة {selectedTestShipments.length} شحنة بدون إرسال أي بيانات خارج T-Flow.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-muted/25 p-4 text-[12px] leading-6">
            <p className="font-bold">المرحلة التالية</p>
            <p className="text-muted-foreground">جاهزة ← قيد النقل ← تم التسليم</p>
            <p className="mt-3 font-bold">استثناء تجريبي</p>
            <p className="text-muted-foreground">يسجل فشل التوصيل ويحدّث حالة الطلب.</p>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              type="button"
              onClick={() => handleSimulation('advance')}
              disabled={simulateShipments.isPending || bulkUpdate.isPending}
            >
              {simulateShipments.isPending || bulkUpdate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Truck className="h-4 w-4" />
              )}
              الانتقال للمرحلة التالية
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-500/30 text-red-500 hover:bg-red-500/10"
              onClick={() => handleSimulation('exception')}
              disabled={simulateShipments.isPending || bulkUpdate.isPending}
            >
              <AlertTriangle className="h-4 w-4" />
              محاكاة استثناء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  )
}
