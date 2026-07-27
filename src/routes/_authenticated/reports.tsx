import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useOrders } from '~/lib/queries'
import { Button } from '~/components/ui/button'
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  Download,
  Users,
  Phone,
  DollarSign,
} from 'lucide-react'
import { formatCurrency } from '~/lib/utils'
import { STATUS, toExportRow } from '~/lib/sheet-mapping'
import { ErrorState, EmptyState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

export const Route = createFileRoute('/_authenticated/reports')({
  component: ReportsPage,
})

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="h-[130px] rounded-[15px] skeleton-shimmer" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-[240px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
    </div>
  )
}

function ReportsPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const orders = data?.orders || []

  const analytics = useMemo(() => {
    const totalOrders = orders.length
    const delivered = orders.filter((o) => o.status === STATUS.DELIVERED)
    const cancelled = orders.filter((o) => o.status === STATUS.CANCELLED)
    const noAnswer = orders.filter((o) => o.status === STATUS.NO_ANSWER)
    const pending = orders.filter((o) =>
      ([STATUS.PROCESSING, STATUS.PREPARING] as string[]).includes(o.status),
    )

    const totalRevenue = delivered.reduce(
      (sum, o) => sum + (Number(o.price) || 0) * (Number(o.quantity) || 1),
      0,
    )
    const lostRevenue = cancelled.reduce(
      (sum, o) => sum + (Number(o.price) || 0) * (Number(o.quantity) || 1),
      0,
    )

    const customerMap = new Map<string, { name: string; orders: number; revenue: number }>()
    for (const o of orders) {
      const phone = String(o.phone)
      if (!phone) continue
      const existing = customerMap.get(phone) || { name: o.customerName, orders: 0, revenue: 0 }
      existing.orders++
      if (o.status === STATUS.DELIVERED)
        existing.revenue += (Number(o.price) || 0) * (Number(o.quantity) || 1)
      customerMap.set(phone, existing)
    }
    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10)

    const uniquePhones = new Set(orders.map((o) => String(o.phone)).filter(Boolean))
    const repeatCustomers = Array.from(customerMap.values()).filter((c) => c.orders > 1).length
    const repeatRate =
      uniquePhones.size > 0 ? Math.round((repeatCustomers / uniquePhones.size) * 100) : 0
    const noAnswerRate = totalOrders > 0 ? Math.round((noAnswer.length / totalOrders) * 100) : 0

    return {
      totalOrders,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      noAnswerCount: noAnswer.length,
      pendingCount: pending.length,
      totalRevenue,
      lostRevenue,
      conversionRate: totalOrders > 0 ? Math.round((delivered.length / totalOrders) * 100) : 0,
      cancelRate: totalOrders > 0 ? Math.round((cancelled.length / totalOrders) * 100) : 0,
      noAnswerRate,
      avgOrderValue: delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0,
      topCustomers,
      repeatRate,
      uniqueCustomers: uniquePhones.size,
    }
  }, [orders])

  const handleExportFullReport = () => {
    const reportData = orders.map((o) => ({
      'رقم الطلب': o.order_id,
      ...toExportRow(o),
    }))
    const ws = XLSX.utils.json_to_sheet(reportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير شامل')
    XLSX.writeFile(wb, 'T-Flow_تقرير_شامل.xlsx')
    toast.success('تم تصدير التقرير الشامل')
  }

  if (isLoading) return <ReportsSkeleton />
  if (isError)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    )
  if (orders.length === 0)
    return (
      <EmptyState
        icon={<BarChart3 className="h-8 w-8 text-muted-foreground" />}
        title="لا توجد بيانات كافية للتحليل"
      />
    )

  const rateCards = [
    { label: 'نسبة التحويل', value: `${analytics.conversionRate}%`, color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
    { label: 'نسبة الإلغاء', value: `${analytics.cancelRate}%`, color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
    { label: 'نسبة عدم الرد', value: `${analytics.noAnswerRate}%`, color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
    { label: 'نسبة الزبائن العائدين', value: `${analytics.repeatRate}%`, color: '#e31e24', bg: 'rgba(227,30,36,0.08)' },
  ]

  const financialItems = [
    { label: 'الإيرادات الفعلية', value: formatCurrency(analytics.totalRevenue), color: '#22c55e' },
    { label: 'الخسائر (ملغي)', value: formatCurrency(analytics.lostRevenue), color: '#6b7280' },
    { label: 'متوسط قيمة الطلب', value: formatCurrency(analytics.avgOrderValue) },
    { label: 'صافي الإيرادات المتوقع', value: formatCurrency(analytics.totalRevenue - analytics.lostRevenue), color: '#e31e24' },
  ]

  const problemItems = [
    { label: 'طلبات ملغية', count: analytics.cancelledCount, color: '#6b7280', bg: 'rgba(107,114,128,0.08)', icon: AlertTriangle },
    { label: 'لم يردّ', count: analytics.noAnswerCount, color: '#f97316', bg: 'rgba(249,115,22,0.08)', icon: Phone },
    { label: 'معلّقة', count: analytics.pendingCount, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: Clock },
  ]

  return (
    <RoleGuard roles={['admin']}>
      <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportFullReport}
            className="gap-1.5 h-10 rounded-[11px] border-border font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            تصدير التقرير
          </Button>
        </div>

        <div className="dc-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[14.5px] font-extrabold">مقاييس الأداء الرئيسية</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {rateCards.map((card) => (
              <div
                key={card.label}
                className="text-center p-4 rounded-[13px]"
                style={{ background: card.bg }}
              >
                <p className="text-[11px] text-muted-foreground mb-1">{card.label}</p>
                <p className="font-mono text-[22px] font-bold" style={{ color: card.color }}>{card.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="dc-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-[14.5px] font-extrabold">الملخص المالي</h3>
            </div>
            <div className="flex flex-col gap-3.5">
              {financialItems.map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-[12.5px] text-muted-foreground">{item.label}</span>
                  <span className="font-mono text-[13px] font-bold" style={item.color ? { color: item.color } : undefined}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="dc-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-[14.5px] font-extrabold">ملخص المشاكل</h3>
            </div>
            <div className="flex flex-col gap-3">
              {problemItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between p-3 rounded-[11px]"
                  style={{ background: item.bg }}
                >
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" style={{ color: item.color }} />
                    <span className="text-[12.5px]">{item.label}</span>
                  </div>
                  <span className="font-mono text-[13px] font-bold" style={{ color: item.color }}>{item.count}</span>
                </div>
              ))}
              <div className="h-px bg-[var(--color-divider)]" />
              <div className="flex justify-between items-center">
                <span className="text-[12.5px] text-muted-foreground">الزبائن الفريدون</span>
                <span className="font-mono text-[13px] font-bold">{analytics.uniqueCustomers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12.5px] text-muted-foreground">الزبائن العائدون</span>
                <span className="font-mono text-[13px] font-bold" style={{ color: '#e31e24' }}>{analytics.repeatRate}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="dc-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[14.5px] font-extrabold">أفضل الزبائن (حسب الطلبات)</h3>
          </div>
          <div className="flex flex-col">
            {analytics.topCustomers.slice(0, 8).map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2.5 border-b border-divider last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground w-5">#{i + 1}</span>
                  <span className="text-[12.5px] font-semibold">{c.name}</span>
                </div>
                <div className="text-start">
                  <span className="inline-flex items-center h-5 px-2 rounded-full border border-divider text-[10px] font-bold text-muted-foreground">
                    {c.orders} طلب
                  </span>
                  {c.revenue > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{formatCurrency(c.revenue)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}
