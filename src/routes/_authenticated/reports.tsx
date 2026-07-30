import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CircleDollarSign,
  Download,
  MapPin,
  PackageCheck,
  Percent,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { EmptyState, ErrorState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
  buildReportInsights,
  filterOrdersByReportRange,
  type ReportRange,
} from '~/lib/report-insights'
import { useOrders } from '~/lib/queries'
import { STATUS_MAP, toExportRow } from '~/lib/sheet-mapping'
import { cn, formatCurrency } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/reports')({
  component: ReportsPage,
})

const RANGE_OPTIONS: Array<{ value: ReportRange; label: string }> = [
  { value: 'all', label: 'كل الفترة' },
  { value: 'today', label: 'اليوم' },
  { value: '7d', label: '7 أيام' },
  { value: '30d', label: '30 يومًا' },
  { value: 'custom', label: 'فترة مخصصة' },
]

const STATUS_FALLBACK_COLORS = ['#e31e24', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#6b7280']

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="h-[92px] rounded-[15px] skeleton-shimmer" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-[118px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
        <div className="h-[320px] rounded-[15px] skeleton-shimmer" />
        <div className="h-[320px] rounded-[15px] skeleton-shimmer" />
      </div>
    </div>
  )
}

function ReportsPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const [range, setRange] = useState<ReportRange>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const orders = useMemo(() => data?.orders ?? [], [data])
  const filteredOrders = useMemo(
    () => filterOrdersByReportRange(orders, { range, customStart, customEnd }),
    [customEnd, customStart, orders, range],
  )
  const insights = useMemo(() => buildReportInsights(filteredOrders), [filteredOrders])

  if (isLoading) return <ReportsSkeleton />
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    )
  }
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-8 w-8 text-muted-foreground" />}
        title="لا توجد بيانات كافية للتقارير"
      />
    )
  }

  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label ?? 'كل الفترة'
  const maxDailyOrders = Math.max(...insights.dailyTrend.map((item) => item.orders), 1)
  const visibleDailyTrend = insights.dailyTrend.slice(-14)
  const topWilayas = insights.wilayas.slice(0, 7)
  const topProducts = insights.products.slice(0, 6)

  const handleExport = () => {
    if (filteredOrders.length === 0) {
      toast.error('لا توجد طلبات في الفترة المحددة')
      return
    }

    const summaryRows = [
      { المؤشر: 'الفترة', القيمة: rangeLabel },
      { المؤشر: 'إجمالي الطلبات', القيمة: insights.totalOrders },
      { المؤشر: 'عدد الوحدات', القيمة: insights.totalUnits },
      { المؤشر: 'العملاء', القيمة: insights.uniqueCustomers },
      { المؤشر: 'تم التسليم', القيمة: insights.deliveredCount },
      { المؤشر: 'نسبة التسليم', القيمة: `${insights.deliveryRate}%` },
      { المؤشر: 'الإيرادات المحققة', القيمة: insights.totalRevenue },
      { المؤشر: 'متوسط الطلب المسلّم', القيمة: insights.averageOrderValue },
    ]
    const orderRows = filteredOrders.map((order) => ({
      'رقم الطلب': order.order_id,
      ...toExportRow(order),
    }))
    const wilayaRows = insights.wilayas.map((item) => ({
      الولاية: item.label,
      الطلبات: item.orders,
      'تم التسليم': item.delivered,
      'نسبة التسليم': `${item.rate}%`,
      الإيرادات: item.revenue,
    }))
    const productRows = insights.products.map((item) => ({
      المنتج: item.label,
      الطلبات: item.orders,
      'تم التسليم': item.delivered,
      'نسبة التسليم': `${item.rate}%`,
      الإيرادات: item.revenue,
    }))

    const workbook = XLSX.utils.book_new()
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows)
    const ordersSheet = XLSX.utils.json_to_sheet(orderRows)
    const wilayasSheet = XLSX.utils.json_to_sheet(wilayaRows)
    const productsSheet = XLSX.utils.json_to_sheet(productRows)
    summarySheet['!cols'] = [{ wch: 24 }, { wch: 22 }]
    ordersSheet['!cols'] = Array(15).fill({ wch: 18 })
    wilayasSheet['!cols'] = Array(5).fill({ wch: 18 })
    productsSheet['!cols'] = Array(5).fill({ wch: 22 })
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'الملخص')
    XLSX.utils.book_append_sheet(workbook, ordersSheet, 'الطلبات')
    XLSX.utils.book_append_sheet(workbook, wilayasSheet, 'الولايات')
    XLSX.utils.book_append_sheet(workbook, productsSheet, 'المنتجات')
    XLSX.writeFile(workbook, `T-Flow_تقرير_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success(`تم تصدير ${filteredOrders.length} طلب`)
  }

  const kpis = [
    {
      label: 'إجمالي الطلبات',
      value: insights.totalOrders,
      detail: `${insights.totalUnits} وحدة مطلوبة`,
      icon: ShoppingCart,
      accent: '#e31e24',
      background: 'rgba(227,30,36,0.1)',
    },
    {
      label: 'الإيرادات المحققة',
      value: formatCurrency(insights.totalRevenue),
      detail: `${insights.deliveredCount} طلب مسلّم`,
      icon: CircleDollarSign,
      accent: '#16a34a',
      background: 'rgba(22,163,74,0.1)',
    },
    {
      label: 'نسبة التسليم',
      value: `${insights.deliveryRate}%`,
      detail: 'من إجمالي طلبات الفترة',
      icon: Percent,
      accent: '#3b82f6',
      background: 'rgba(59,130,246,0.1)',
    },
    {
      label: 'متوسط الطلب المسلّم',
      value: formatCurrency(insights.averageOrderValue),
      detail: `${insights.uniqueCustomers} عميل فريد`,
      icon: Users,
      accent: '#8b5cf6',
      background: 'rgba(139,92,246,0.1)',
    },
  ]

  return (
    <RoleGuard roles={['admin']}>
      <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
        <section className="dc-card p-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h2 className="text-[14px] font-extrabold">فترة التقرير</h2>
              </div>
              <p className="text-[11.5px] text-muted-foreground mt-1">
                عرض {filteredOrders.length} من أصل {orders.length} طلب
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="flex flex-wrap gap-1.5">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRange(option.value)}
                    className={cn(
                      'h-9 px-3 rounded-[9px] border text-[12px] font-bold transition-colors',
                      range === option.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border bg-background hover:bg-muted',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <Button onClick={handleExport} disabled={filteredOrders.length === 0}>
                <Download className="h-4 w-4" />
                تصدير التقرير
              </Button>
            </div>
          </div>

          {range === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-divider max-w-xl">
              <label className="space-y-1.5">
                <span className="text-[11.5px] font-semibold text-muted-foreground">من تاريخ</span>
                <Input
                  type="date"
                  value={customStart}
                  max={customEnd || undefined}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="h-10"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11.5px] font-semibold text-muted-foreground">إلى تاريخ</span>
                <Input
                  type="date"
                  value={customEnd}
                  min={customStart || undefined}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="h-10"
                />
              </label>
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon
            return (
              <article
                key={kpi.label}
                className="relative overflow-hidden bg-card p-4 md:p-[18px] kpi-accent"
                style={{
                  border: '1px solid var(--color-card-border)',
                  borderRadius: 'var(--color-card-radius)',
                  ['--kpi-color' as string]: kpi.accent,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11.5px] md:text-[12.5px] text-muted-foreground font-medium">
                      {kpi.label}
                    </p>
                    <p className="font-mono text-[20px] md:text-[26px] font-bold mt-1.5 truncate">
                      {kpi.value}
                    </p>
                  </div>
                  <div
                    className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0"
                    style={{ color: kpi.accent, background: kpi.background }}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                </div>
                <p className="text-[10.5px] md:text-[11px] text-muted-foreground mt-3">
                  {kpi.detail}
                </p>
              </article>
            )
          })}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="dc-card py-14">
            <EmptyState
              icon={<CalendarDays className="h-8 w-8 text-muted-foreground" />}
              title="لا توجد طلبات في الفترة المحددة"
              description="جرّب اختيار فترة زمنية أوسع"
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
              <section className="dc-card p-5 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-[14.5px] font-extrabold">حركة الطلبات</h3>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      آخر 14 يومًا ضمن الفترة
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {visibleDailyTrend.reduce((sum, item) => sum + item.orders, 0)} طلب
                  </span>
                </div>
                {visibleDailyTrend.length > 0 ? (
                  <div className="h-[220px] flex items-end gap-2 md:gap-3 overflow-x-auto pb-1">
                    {visibleDailyTrend.map((item) => {
                      const height = Math.max((item.orders / maxDailyOrders) * 100, 8)
                      const label = new Intl.DateTimeFormat('ar-DZ', {
                        day: 'numeric',
                        month: 'short',
                      }).format(new Date(`${item.date}T00:00:00`))
                      return (
                        <div
                          key={item.date}
                          className="h-full min-w-[42px] flex-1 flex flex-col items-center justify-end gap-2"
                        >
                          <span className="font-mono text-[10px] font-bold">{item.orders}</span>
                          <div className="w-full max-w-[38px] h-[150px] bg-muted rounded-t-[9px] overflow-hidden flex items-end">
                            <div
                              className="w-full rounded-t-[9px]"
                              style={{
                                height: `${height}%`,
                                background: 'linear-gradient(180deg, #ef4444, #991b1b)',
                                animation: 'tfRise 0.8s ease both',
                              }}
                            />
                          </div>
                          <span className="text-[9.5px] text-muted-foreground whitespace-nowrap">
                            {label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                    تواريخ الطلبات غير متوفرة للرسم
                  </p>
                )}
              </section>

              <section className="dc-card p-5">
                <div className="flex items-center gap-2 mb-5">
                  <PackageCheck className="h-4 w-4 text-primary" />
                  <h3 className="text-[14.5px] font-extrabold">توزيع الحالات</h3>
                </div>
                <div className="flex flex-col gap-4">
                  {insights.statusBreakdown.map((item, index) => {
                    const statusMeta = STATUS_MAP[item.label]
                    const color = statusMeta?.cssVar
                      ? `var(${statusMeta.cssVar})`
                      : STATUS_FALLBACK_COLORS[index % STATUS_FALLBACK_COLORS.length]
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className="text-[12px] font-semibold flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                            {item.label}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {item.count} · {item.percentage}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${item.percentage}%`,
                              background: color,
                              animation: 'tfGrow 0.8s ease both',
                              transformOrigin: 'right',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <section className="dc-card p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h3 className="text-[14.5px] font-extrabold">أداء الولايات</h3>
                  </div>
                  <span className="text-[10.5px] text-muted-foreground">حسب عدد الطلبات</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[470px] text-right">
                    <thead>
                      <tr className="border-b border-divider text-[10.5px] text-muted-foreground">
                        <th className="font-semibold py-2">الولاية</th>
                        <th className="font-semibold py-2 text-center">الطلبات</th>
                        <th className="font-semibold py-2 text-center">مسلّمة</th>
                        <th className="font-semibold py-2 text-center">النسبة</th>
                        <th className="font-semibold py-2 text-left">الإيرادات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topWilayas.map((item, index) => (
                        <tr key={item.label} className="border-b border-divider last:border-0">
                          <td className="py-3 text-[12.5px] font-semibold">
                            <span className="text-muted-foreground font-mono ml-2">
                              {index + 1}
                            </span>
                            {item.label}
                          </td>
                          <td className="py-3 text-center font-mono text-[12px]">{item.orders}</td>
                          <td className="py-3 text-center font-mono text-[12px]">
                            {item.delivered}
                          </td>
                          <td className="py-3 text-center">
                            <span
                              className={cn(
                                'inline-flex px-2 py-0.5 rounded-full font-mono text-[10.5px] font-bold',
                                item.rate >= 60
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : 'bg-amber-500/10 text-amber-500',
                              )}
                            >
                              {item.rate}%
                            </span>
                          </td>
                          <td className="py-3 text-left font-mono text-[11.5px] font-bold">
                            {formatCurrency(item.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="dc-card p-5">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-2">
                    <PackageCheck className="h-4 w-4 text-primary" />
                    <h3 className="text-[14.5px] font-extrabold">أفضل المنتجات</h3>
                  </div>
                  <span className="text-[10.5px] text-muted-foreground">حسب عدد الطلبات</span>
                </div>
                <div className="flex flex-col gap-4">
                  {topProducts.map((item) => {
                    const width = topProducts[0]
                      ? Math.max((item.orders / topProducts[0].orders) * 100, 5)
                      : 0
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-semibold truncate">{item.label}</p>
                            <p className="text-[10.5px] text-muted-foreground mt-0.5">
                              {item.delivered} مسلّم · نسبة {item.rate}%
                            </p>
                          </div>
                          <div className="text-left shrink-0">
                            <p className="font-mono text-[12px] font-bold">{item.orders} طلب</p>
                            <p className="font-mono text-[10px] text-emerald-500 mt-0.5">
                              {formatCurrency(item.revenue)}
                            </p>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${width}%`,
                              background: 'linear-gradient(90deg, #7d1622, #e31e24)',
                              animation: 'tfGrow 0.8s ease both',
                              transformOrigin: 'right',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>
          </>
        )}

        {data?.fromCache && (
          <p className="text-[10px] text-muted-foreground text-center">
            البيانات من الذاكرة المؤقتة — آخر تحديث: {new Date().toLocaleTimeString('ar-DZ')}
          </p>
        )}
      </div>
    </RoleGuard>
  )
}
