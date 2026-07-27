import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useOrders } from '~/lib/queries'
import { Button } from '~/components/ui/button'
import {
  TrendingUp,
  Download,
  Users,
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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return parts[0][0] + parts[1][0]
  return parts[0]?.slice(0, 2) || '??'
}

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-[300px] rounded-[15px] skeleton-shimmer" />
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

    return {
      totalOrders,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      noAnswerCount: noAnswer.length,
      pendingCount: pending.length,
      totalRevenue,
      conversionRate: totalOrders > 0 ? Math.round((delivered.length / totalOrders) * 100) : 0,
      cancelRate: totalOrders > 0 ? Math.round((cancelled.length / totalOrders) * 100) : 0,
      noAnswerRate: totalOrders > 0 ? Math.round((noAnswer.length / totalOrders) * 100) : 0,
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
        icon={<TrendingUp className="h-8 w-8 text-muted-foreground" />}
        title="لا توجد بيانات كافية للتحليل"
      />
    )

  const statusItems = [
    { label: 'تم التسليم', count: analytics.deliveredCount, color: '#22c55e' },
    { label: 'ملغي', count: analytics.cancelledCount, color: '#6b7280' },
    { label: 'ما ردّش', count: analytics.noAnswerCount, color: '#f97316' },
    { label: 'معلّق', count: analytics.pendingCount, color: '#f59e0b' },
  ]

  return (
    <RoleGuard roles={['admin']}>
      <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
        <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-4">
          {/* Top customers — left column */}
          <div className="dc-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-[14.5px] font-extrabold">أفضل الزبائن</h3>
            </div>
            <div className="flex flex-col">
              {analytics.topCustomers.slice(0, 8).map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2.5 border-b border-divider last:border-0"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-[13px]"
                    style={{ background: 'linear-gradient(135deg, #e31e24, #7d1622)' }}
                  >
                    {getInitials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{c.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10.5px] text-muted-foreground">{c.orders} طلب</span>
                      {c.revenue > 0 && (
                        <span className="font-mono text-[10.5px] text-muted-foreground">{formatCurrency(c.revenue)}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">#{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — status summary + export card */}
          <div className="flex flex-col gap-4">
            {/* Status summary */}
            <div className="dc-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-[14.5px] font-extrabold">ملخص الحالة</h3>
              </div>
              <div className="flex flex-col gap-3">
                {statusItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                      <span className="text-[12.5px] text-muted-foreground">{item.label}</span>
                    </div>
                    <span className="font-mono text-[13px] font-bold" style={{ color: item.color }}>
                      {item.count}
                    </span>
                  </div>
                ))}
                <div className="h-px bg-[var(--color-divider)]" />
                <div className="flex justify-between items-center">
                  <span className="text-[12.5px] text-muted-foreground">نسبة التحويل</span>
                  <span className="font-mono text-[13px] font-bold text-[var(--status-delivered)]">{analytics.conversionRate}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[12.5px] text-muted-foreground">نسبة الإلغاء</span>
                  <span className="font-mono text-[13px] font-bold text-[var(--status-cancelled)]">{analytics.cancelRate}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[12.5px] text-muted-foreground">زبائن عائدون</span>
                  <span className="font-mono text-[13px] font-bold" style={{ color: '#e31e24' }}>{analytics.repeatRate}%</span>
                </div>
              </div>
            </div>

            {/* Dark export card */}
            <div
              className="p-5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #0e1113, #1c1f23)',
                borderRadius: 'var(--color-card-radius)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="relative z-10">
                <h3 className="text-[14.5px] font-extrabold text-white mb-1">تصدير التقرير</h3>
                <p className="text-[12px] text-white/50 mb-4">تحميل ملف شامل بكل البيانات</p>
                <Button
                  onClick={handleExportFullReport}
                  className="h-10 rounded-[11px] font-bold text-[13px] text-white"
                  style={{ background: '#e31e24', animation: 'tfPulse 2s ease infinite' }}
                >
                  <Download className="h-4 w-4 ml-1" />
                  تصدير شامل (.xlsx)
                </Button>
              </div>
              <div
                className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-20"
                style={{ background: 'radial-gradient(circle, #e31e24, transparent 70%)' }}
              />
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}
