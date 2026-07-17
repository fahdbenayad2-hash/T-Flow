import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useMemo, useCallback } from 'react'
import { useOrders, useBulkUpdateOrders } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Checkbox } from '~/components/ui/checkbox'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  RefreshCw,
  AlertTriangle,
  Search,
  Download,
  Filter,
  X,
  AlertCircle,
  ArrowUpDown,
} from 'lucide-react'
import { STATUS_MAP, STATUS_OPTIONS, formatCurrency, formatDate } from '~/lib/utils'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

export const Route = createFileRoute('/_authenticated/orders')({
  component: OrdersPage,
})

function OrdersPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const bulkMutation = useBulkUpdateOrders()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [wilayaFilter, setWilayaFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [sortField, setSortField] = useState<'_row' | 'التاريخ' | 'الحالة'>('_row')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const orders = data?.orders || []

  const wilayas = useMemo(() => {
    const set = new Set(orders.map((o) => String(o['الولاية'])).filter(Boolean))
    return Array.from(set).sort()
  }, [orders])

  const products = useMemo(() => {
    const set = new Set(orders.map((o) => o['المنتج']).filter(Boolean))
    return Array.from(set).sort()
  }, [orders])

  const duplicates = useMemo(() => {
    const phoneMap = new Map<string, Set<number>>()
    orders.forEach((o) => {
      const phone = String(o['الهاتف'])
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
        (o) =>
          String(o['الاسم']).toLowerCase().includes(q) ||
          String(o['الهاتف']).includes(q)
      )
    }
    if (statusFilter !== 'all') {
      result = result.filter((o) => o['الحالة'] === statusFilter)
    }
    if (wilayaFilter !== 'all') {
      result = result.filter((o) => String(o['الولاية']) === wilayaFilter)
    }
    if (productFilter !== 'all') {
      result = result.filter((o) => o['المنتج'] === productFilter)
    }

    result.sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''
      if (sortField === '_row') {
        aVal = a._row
        bVal = b._row
      } else if (sortField === 'التاريخ') {
        aVal = a['التاريخ']
        bVal = b['التاريخ']
      } else if (sortField === 'الحالة') {
        aVal = a['الحالة']
        bVal = b['الحالة']
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
      updates: { 'الحالة': bulkStatus },
    }))

    toast.loading(`جاري تحديث ${items.length} طلب...`, { id: 'bulk' })

    const results = await bulkMutation.mutateAsync(items)
    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    toast.dismiss('bulk')

    if (failCount > 0) {
      toast.error(`تم تحديث ${successCount} طلب، فشل ${failCount}`)
    } else {
      toast.success(`تم تحديث ${successCount} طلب بنجاح`)
    }

    setSelectedRows(new Set())
    setBulkStatus('')
  }

  const handleExport = (format: 'xlsx' | 'csv') => {
    const exportData = filteredOrders.map((o) => ({
      'رقم الصف': o._row,
      'رقم الطلب': o.order_id,
      'الاسم': o['الاسم'],
      'الهاتف': o['الهاتف'],
      'الولاية': o['الولاية'],
      'البلدية': o['البلدية'],
      'المنتج': o['المنتج'],
      'اللون': o['اللون'],
      'المقاس': o['المقاس'],
      'السعر': o['السعر'],
      'الكمية': o['الكمية'],
      'نوع التوصيل': o['نوع التوصيل'],
      'التاريخ': o['التاريخ'],
      'الحالة': o['الحالة'],
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-32" />
          ))}
        </div>
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">فشل تحميل الطلبات</p>
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
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={wilayaFilter} onValueChange={setWilayaFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="الولاية" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الولايات</SelectItem>
              {wilayas.map((w) => (
                <SelectItem key={w} value={w}>{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="المنتج" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المنتجات</SelectItem>
              {products.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selectedRows.size > 0 && (
          <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg">
            <span className="text-sm font-medium">{selectedRows.size} محدد</span>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="تغيير الحالة" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleBulkUpdate} disabled={bulkMutation.isPending || !bulkStatus}>
              تطبيق
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedRows(new Set())}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="mr-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('xlsx')}>
            <Download className="h-4 w-4 ml-1" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 ml-1" />
            CSV
          </Button>
        </div>
      </div>

      {duplicates.size > 0 && (
        <div className="flex items-center gap-2 bg-[var(--status-processing)]/10 text-[var(--status-processing)] px-3 py-2 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" />
          تم كشف {duplicates.size} طلب مكرر (هاتف مكرر خلال 7 أيام)
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 w-10">
                <Checkbox
                  checked={selectedRows.size === filteredOrders.length && filteredOrders.length > 0}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="p-3 text-right font-medium">#</th>
              <th className="p-3 text-right font-medium cursor-pointer hover:bg-muted/80"
                  onClick={() => { setSortField('_row'); setSortDir(d => d === 'asc' ? 'desc' : 'asc') }}>
                <span className="flex items-center gap-1">
                  الطلب
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </th>
              <th className="p-3 text-right font-medium">الاسم</th>
              <th className="p-3 text-right font-medium">الهاتف</th>
              <th className="p-3 text-right font-medium">الولاية</th>
              <th className="p-3 text-right font-medium">المنتج</th>
              <th className="p-3 text-right font-medium">السعر</th>
              <th className="p-3 text-right font-medium">
                <span className="flex items-center gap-1">
                  الحالة
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </th>
              <th className="p-3 text-right font-medium">
                <span className="flex items-center gap-1">
                  التاريخ
                  <ArrowUpDown className="h-3 w-3" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-10 text-center text-muted-foreground">
                  لا توجد طلبات مطابقة
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const statusInfo = STATUS_MAP[order['الحالة']]
                const isDup = duplicates.has(order._row)
                return (
                  <tr
                    key={order._row}
                    className={`border-b hover:bg-muted/30 cursor-pointer transition-colors ${
                      isDup ? 'bg-[var(--status-processing)]/5' : ''
                    }`}
                  >
                    <td className="p-3">
                      <Checkbox
                        checked={selectedRows.has(order._row)}
                        onCheckedChange={() => toggleRow(order._row)}
                      />
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{order._row}</td>
                    <td className="p-3">
                      <Link
                        to="/orders/$row"
                        params={{ row: String(order._row) }}
                        className="text-primary hover:underline font-medium text-xs"
                      >
                        {order.order_id}
                      </Link>
                      {isDup && (
                        <Badge className="mr-1 text-[9px] bg-[var(--status-processing)] text-white">مكرر</Badge>
                      )}
                    </td>
                    <td className="p-3 font-medium">{order['الاسم']}</td>
                    <td className="p-3 font-mono text-xs" dir="ltr">{order['الهاتف']}</td>
                    <td className="p-3 text-xs">{order['الولاية']}</td>
                    <td className="p-3 text-xs max-w-[150px] truncate">{order['المنتج']}</td>
                    <td className="p-3 font-mono text-xs">
                      {order['السعر'] ? formatCurrency(Number(order['السعر'])) : '-'}
                    </td>
                    <td className="p-3">
                      <Badge
                        className="text-[10px]"
                        style={{
                          backgroundColor: `var(${statusInfo?.var || '--status-processing'})`,
                          color: '#fff',
                        }}
                      >
                        {order['الحالة']}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDate(order['التاريخ'])}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>إجمالي: {filteredOrders.length} طلب من {orders.length}</span>
        {data?.fromCache && <span>بيانات مؤقتة — آخر تحديث: {new Date().toLocaleTimeString('ar-DZ')}</span>}
      </div>
    </div>
  )
}
