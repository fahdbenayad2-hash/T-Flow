import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useMemo, useCallback, useRef } from 'react'
import { useOrders, useBulkUpdateOrders } from '~/lib/queries'
import { Card, CardContent } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Checkbox } from '~/components/ui/checkbox'
import { Skeleton } from '~/components/ui/skeleton'
import { useRole } from '~/hooks/useRole'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Download, X, AlertCircle, ArrowUpDown, Filter } from 'lucide-react'
import { formatCurrency, formatDate } from '~/lib/utils'
import { ALL_STATUSES, toExportRow } from '~/lib/sheet-mapping'
import { StaggerContainer, FadeIn } from '~/components/page-transition'
import { ErrorState, OrdersEmptyState } from '~/components/empty-state'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { motion } from 'framer-motion'
import { useVirtualizer } from '@tanstack/react-virtual'
import { StatusBadge } from '~/components/status-badge'

export const Route = createFileRoute('/_authenticated/orders')({
  component: OrdersPage,
})

function OrdersSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-32 rounded-lg" />
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="space-y-0">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function OrdersPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const bulkMutation = useBulkUpdateOrders()
  const { canBulkEdit } = useRole()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [wilayaFilter, setWilayaFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [sortField, setSortField] = useState<'_row' | 'date' | 'status'>('_row')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const orders = useMemo(() => data?.orders ?? [], [data])

  const wilayas = useMemo(() => {
    const set = new Set(orders.map((o) => String(o.wilaya)).filter(Boolean))
    return Array.from(set).sort()
  }, [orders])

  const products = useMemo(() => {
    const set = new Set(orders.map((o) => o.product).filter(Boolean))
    return Array.from(set).sort()
  }, [orders])

  const duplicates = useMemo(() => {
    const phoneMap = new Map<string, Set<number>>()
    orders.forEach((o) => {
      const phone = String(o.phone)
      if (!phone) return
      if (!phoneMap.has(phone)) phoneMap.set(phone, new Set())
      phoneMap.get(phone)!.add(o._row)
    })
    const dupRows = new Set<number>()
    phoneMap.forEach((rows) => {
      if (rows.size > 1) rows.forEach((r) => dupRows.add(r))
    })
    return dupRows
  }, [orders])

  const filteredOrders = useMemo(() => {
    let result = [...orders]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (o) => String(o.customerName).toLowerCase().includes(q) || String(o.phone).includes(q),
      )
    }
    if (statusFilter !== 'all') {
      result = result.filter((o) => o.status === statusFilter)
    }
    if (wilayaFilter !== 'all') {
      result = result.filter((o) => String(o.wilaya) === wilayaFilter)
    }
    if (productFilter !== 'all') {
      result = result.filter((o) => o.product === productFilter)
    }

    result.sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      if (sortField === '_row') {
        aVal = a._row
        bVal = b._row
      } else if (sortField === 'date') {
        aVal = a.date
        bVal = b.date
      } else if (sortField === 'status') {
        aVal = a.status
        bVal = b.status
      }
      if (sortDir === 'asc') return aVal > bVal ? 1 : -1
      return aVal < bVal ? 1 : -1
    })

    return result
  }, [orders, search, statusFilter, wilayaFilter, productFilter, sortField, sortDir])

  const toggleRow = useCallback((row: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(row)) next.delete(row)
      else next.add(row)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (selectedRows.size === filteredOrders.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filteredOrders.map((o) => o._row)))
    }
  }, [selectedRows.size, filteredOrders])

  const handleBulkUpdate = async () => {
    if (!bulkStatus || selectedRows.size === 0) {
      toast.error('اختر الحالة والطلبات')
      return
    }
    const items = Array.from(selectedRows).map((row) => ({
      row,
      updates: { status: bulkStatus },
    }))
    toast.loading(`جاري تحديث ${items.length} طلب...`, { id: 'bulk' })
    try {
      const { count } = await bulkMutation.mutateAsync(items)
      toast.dismiss('bulk')
      toast.success(`تم تحديث ${count} طلب بنجاح`)
      setSelectedRows(new Set())
      setBulkStatus('')
    } catch (error) {
      toast.dismiss('bulk')
      toast.error(error instanceof Error ? error.message : 'فشل التحديث الجماعي')
    }
  }

  const handleExport = (format: 'xlsx' | 'csv') => {
    const exportData = filteredOrders.map((o) => ({
      'رقم الصف': o._row,
      'رقم الطلب': o.order_id,
      ...toExportRow(o),
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'الطلبات')
    if (format === 'xlsx') {
      XLSX.writeFile(wb, 'T-Flow_الطلبات.xlsx')
    } else {
      XLSX.writeFile(wb, 'T-Flow_الطلبات.csv', { bookType: 'csv' })
    }
    toast.success('تم التصدير بنجاح')
  }

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: filteredOrders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  })

  if (isLoading) return <OrdersSkeleton />

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    )
  }

  const hasActiveFilters =
    search || statusFilter !== 'all' || wilayaFilter !== 'all' || productFilter !== 'all'
  const activeFilterCount =
    [statusFilter, wilayaFilter, productFilter].filter((f) => f !== 'all').length + (search ? 1 : 0)

  return (
    <StaggerContainer className="space-y-4">
      {/* Search + Filters */}
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              ⌕
            </span>
            <Input
              placeholder="بحث بالاسم أو رقم الهاتف…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="start-9 h-10 rounded-[11px] border-border"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-auto h-10 rounded-[11px] border-border px-3.5">
                <SelectValue placeholder="كل الحالات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={wilayaFilter} onValueChange={setWilayaFilter}>
              <SelectTrigger className="w-auto h-10 rounded-[11px] border-border px-3.5">
                <SelectValue placeholder="كل الولايات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الولايات</SelectItem>
                {wilayas.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-auto h-10 rounded-[11px] border-border px-3.5">
                <SelectValue placeholder="كل المنتجات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المنتجات</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                  setWilayaFilter('all')
                  setProductFilter('all')
                }}
                className="text-muted-foreground gap-1"
              >
                <X className="h-3.5 w-3.5" />
                مسح
                {activeFilterCount > 0 && (
                  <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </FadeIn>

      {/* Bulk edit + Export */}
      <FadeIn delay={0.1}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {canBulkEdit && selectedRows.size > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg"
              >
                <span className="text-sm font-medium text-primary">{selectedRows.size} محدد</span>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger className="w-[130px] h-8">
                    <SelectValue placeholder="تغيير الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleBulkUpdate}
                  disabled={bulkMutation.isPending || !bulkStatus}
                >
                  تطبيق
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedRows(new Set())}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('xlsx')}
              className="gap-1.5 h-10 rounded-[11px] border-border font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              تصدير Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              className="gap-1.5 h-10 rounded-[11px] border-border font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Duplicate warning */}
      {duplicates.size > 0 && (
        <FadeIn delay={0.12}>
          <div className="flex items-center gap-2 bg-[var(--status-processing)]/10 border border-[var(--status-processing)]/20 text-[var(--status-processing)] px-3 py-2 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            تم كشف {duplicates.size} طلب مكرر (هاتف مكرر خلال 7 أيام)
          </div>
        </FadeIn>
      )}

      {/* Table */}
      {filteredOrders.length === 0 ? (
        <FadeIn delay={0.15}>
          {hasActiveFilters ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-2xl bg-muted p-5 mb-4">
                <Filter className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold mb-1">لا توجد نتائج</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                جرّب تغيير معايير البحث أو الفلتر
              </p>
            </div>
          ) : (
            <OrdersEmptyState />
          )}
        </FadeIn>
      ) : (
        <FadeIn delay={0.15}>
          <div className="dc-card overflow-hidden">
            {/* Sticky header row */}
            <div
              className="flex items-center text-[11.5px] font-bold text-muted-foreground sticky top-0 z-10"
              style={{
                background: 'var(--color-table-header)',
                borderBottom: '1px solid var(--color-table-border)',
              }}
            >
              {canBulkEdit && (
                <div className="px-3.5 py-3 w-10 shrink-0">
                  <Checkbox
                    checked={
                      selectedRows.size === filteredOrders.length && filteredOrders.length > 0
                    }
                    onCheckedChange={toggleAll}
                  />
                </div>
              )}
              <div className="px-2 py-3 w-[108px] shrink-0">رقم الطلب</div>
              <div
                className="px-2 py-3 flex-1 min-w-[130px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => {
                  setSortField('_row')
                  setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                }}
              >
                <span className="flex items-center gap-1">
                  الزبون
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </div>
              <div className="px-2 py-3 w-[120px] shrink-0">الهاتف</div>
              <div className="px-2 py-3 w-24 shrink-0">الولاية</div>
              <div className="px-2 py-3 w-[150px] shrink-0">المنتج</div>
              <div className="px-2 py-3 w-[104px] shrink-0">السعر</div>
              <div
                className="px-2 py-3 w-[118px] shrink-0 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => {
                  setSortField('status')
                  setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                }}
              >
                <span className="flex items-center gap-1">
                  الحالة
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </div>
              <div
                className="px-2 py-3 w-20 shrink-0 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => {
                  setSortField('date')
                  setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                }}
              >
                <span className="flex items-center gap-1">
                  التاريخ
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </div>
            </div>

            {/* Virtualized body */}
            <div ref={parentRef} className="overflow-auto max-h-[calc(100vh-22rem)]">
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const order = filteredOrders[virtualRow.index]
                  const isDup = duplicates.has(order._row)
                  return (
                    <div
                      key={order._row}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        borderBottomColor: 'var(--color-divider)',
                      }}
                      className={`flex items-center text-[13px] cursor-pointer transition-colors border-b last:border-b-0 ${
                        isDup ? 'bg-[var(--status-processing)]/5' : ''
                      }`}
                    >
                      {canBulkEdit && (
                        <div className="px-3.5 py-2.5 w-10 shrink-0 flex items-center">
                          <Checkbox
                            checked={selectedRows.has(order._row)}
                            onCheckedChange={() => toggleRow(order._row)}
                          />
                        </div>
                      )}
                      <div className="px-2 py-2.5 w-[108px] shrink-0">
                        <Link
                          to="/orders/$row"
                          params={{ row: String(order._row) }}
                          className="text-[#c41a1f] hover:underline font-semibold text-[11.5px] font-mono"
                        >
                          {order.order_id}
                        </Link>
                      </div>
                      <div className="px-2 py-2.5 flex-1 min-w-[130px] font-bold truncate">
                        {order.customerName}
                      </div>
                      <div
                        className="px-2 py-2.5 w-[120px] shrink-0 font-mono text-[11.5px] text-muted-foreground"
                        dir="ltr"
                      >
                        {order.phone}
                      </div>
                      <div className="px-2 py-2.5 w-24 shrink-0 text-muted-foreground">
                        {order.wilaya}
                      </div>
                      <div className="px-2 py-2.5 w-[150px] shrink-0 text-muted-foreground truncate">
                        {order.product}
                      </div>
                      <div className="px-2 py-2.5 w-[104px] shrink-0 font-mono text-[12px] font-semibold">
                        {order.price ? formatCurrency(Number(order.price)) : '-'}
                      </div>
                      <div className="px-2 py-2.5 w-[118px] shrink-0">
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="px-2 py-2.5 w-20 shrink-0 font-mono text-[11px] text-muted-foreground">
                        {formatDate(order.date)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Footer */}
      <div className="text-[12px] text-muted-foreground">
        عرض <b className="text-foreground">{filteredOrders.length}</b> طلب من {orders.length}
      </div>
    </StaggerContainer>
  )
}
