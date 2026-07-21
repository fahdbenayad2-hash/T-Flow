import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useOrders } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
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
import { STATUS_MAP, formatCurrency } from '~/lib/utils'
import { FadeIn, StaggerContainer } from '~/components/page-transition'
import { ErrorState, EmptyState } from '~/components/empty-state'
import { Skeleton } from '~/components/ui/skeleton'
import { RoleGuard } from '~/components/role-guard'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

export const Route = createFileRoute('/_authenticated/reports')({
  component: ReportsPage,
})

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}><CardContent className="p-6"><Skeleton className="skeleton-shimmer h-40 w-full rounded-lg" /></CardContent></Card>
      ))}
    </div>
  )
}

function ReportsPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const orders = data?.orders || []

  const analytics = useMemo(() => {
    // Performance metrics
    const totalOrders = orders.length
    const delivered = orders.filter((o) => o['الحالة'] === 'تم التسليم')
    const cancelled = orders.filter((o) => o['الحالة'] === 'ملغي')
    const noAnswer = orders.filter((o) => o['الحالة'] === 'ما جاوبش')
    const pending = orders.filter((o) => ['قيد المعالجة', 'جاري التجهيز'].includes(o['الحالة']))

    const totalRevenue = delivered.reduce(
      (sum, o) => sum + (Number(o['السعر']) || 0) * (Number(o['الكمية']) || 1), 0
    )
    const lostRevenue = cancelled.reduce(
      (sum, o) => sum + (Number(o['السعر']) || 0) * (Number(o['الكمية']) || 1), 0
    )

    // Top customers by orders
    const customerMap = new Map<string, { name: string; orders: number; revenue: number }>()
    for (const o of orders) {
      const phone = String(o['الهاتف'])
      if (!phone) continue
      const existing = customerMap.get(phone) || { name: o['الاسم'], orders: 0, revenue: 0 }
      existing.orders++
      if (o['الحالة'] === 'تم التسليم') existing.revenue += (Number(o['السعر']) || 0) * (Number(o['الكمية']) || 1)
      customerMap.set(phone, existing)
    }
    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10)

    // Time analysis
    const hourMap = new Map<number, number>()
    for (const o of orders) {
      const hour = new Date(o['التاريخ']).getHours()
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1)
    }

    // Repeat customer rate
    const uniquePhones = new Set(orders.map((o) => String(o['الهاتف'])).filter(Boolean))
    const repeatCustomers = Array.from(customerMap.values()).filter((c) => c.orders > 1).length
    const repeatRate = uniquePhones.size > 0 ? Math.round((repeatCustomers / uniquePhones.size) * 100) : 0

    // No-answer analysis
    const noAnswerRate = totalOrders > 0 ? Math.round((noAnswer.length / totalOrders) * 100) : 0

    // Average delivery time (approximate)
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
      'الاسم': o['الاسم'],
      'الهاتف': o['الهاتف'],
      'الولاية': o['الولاية'],
      'المنتج': o['المنتج'],
      'اللون': o['اللون'],
      'المقاس': o['المقاس'],
      'السعر': o['السعر'],
      'الكمية': o['الكمية'],
      'التاريخ': o['التاريخ'],
      'الحالة': o['الحالة'],
      'نوع التوصيل': o['نوع التوصيل'],
    }))
    const ws = XLSX.utils.json_to_sheet(reportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير شامل')
    XLSX.writeFile(wb, 'T-Flow_تقرير_شامل.xlsx')
    toast.success('تم تصدير التقرير الشامل')
  }

  if (isLoading) return <ReportsSkeleton />
  if (isError) return <ErrorState message={error instanceof Error ? error.message : undefined} onRetry={() => refetch()} />
  if (orders.length === 0) return <EmptyState icon={<BarChart3 className="h-8 w-8 text-muted-foreground" />} title="لا توجد بيانات كافية للتحليل" />

  return (
    <RoleGuard roles={['admin']}>
    <StaggerContainer className="space-y-4">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">التقارير والإحصائيات</h2>
            <p className="text-sm text-muted-foreground">تحليل شامل لأداء المتجر</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportFullReport}>
            <Download className="h-4 w-4 ml-1" />
            تصدير التقرير
          </Button>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              مقاييس الأداء الرئيسية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl bg-[var(--status-delivered)]/10 border border-[var(--status-delivered)]/10">
                <p className="text-xs text-muted-foreground mb-1">نسبة التحويل</p>
                <p className="text-2xl font-bold font-mono text-[var(--status-delivered)]">{analytics.conversionRate}%</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-[var(--status-cancelled)]/10 border border-[var(--status-cancelled)]/10">
                <p className="text-xs text-muted-foreground mb-1">نسبة الإلغاء</p>
                <p className="text-2xl font-bold font-mono text-[var(--status-cancelled)]">{analytics.cancelRate}%</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-[var(--status-no-answer)]/10 border border-[var(--status-no-answer)]/10">
                <p className="text-xs text-muted-foreground mb-1">نسبة عدم الرد</p>
                <p className="text-2xl font-bold font-mono text-[var(--status-no-answer)]">{analytics.noAnswerRate}%</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-primary/10 border border-primary/10">
                <p className="text-xs text-muted-foreground mb-1">نسبة الزبائن العائدين</p>
                <p className="text-2xl font-bold font-mono text-primary">{analytics.repeatRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.15}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                الملخص المالي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">الإيرادات الفعلية</span>
                <span className="font-mono font-bold text-[var(--status-delivered)]">{formatCurrency(analytics.totalRevenue)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">الخسائر (ملغي)</span>
                <span className="font-mono font-bold text-[var(--status-cancelled)]">{formatCurrency(analytics.lostRevenue)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">متوسط قيمة الطلب</span>
                <span className="font-mono font-bold">{formatCurrency(analytics.avgOrderValue)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">صافي الإيرادات المتوقع</span>
                <span className="font-mono font-bold text-primary">
                  {formatCurrency(analytics.totalRevenue - analytics.lostRevenue)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FadeIn delay={0.15}>
          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                أفضل الزبائن (حسب الطلبات)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {analytics.topCustomers.slice(0, 8).map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground w-5">#{i + 1}</span>
                    <span className="text-sm font-medium">{c.name}</span>
                  </div>
                  <div className="text-left">
                    <Badge variant="outline" className="text-[10px]">{c.orders} طلب</Badge>
                    {c.revenue > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{formatCurrency(c.revenue)}</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.2}>
          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                ملخص المشاكل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--status-cancelled)]/10">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[var(--status-cancelled)]" />
                  <span className="text-sm">طلبات ملغية</span>
                </div>
                <span className="font-mono font-bold text-[var(--status-cancelled)]">{analytics.cancelledCount}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--status-no-answer)]/10">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[var(--status-no-answer)]" />
                  <span className="text-sm">لم يردّ</span>
                </div>
                <span className="font-mono font-bold text-[var(--status-no-answer)]">{analytics.noAnswerCount}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--status-processing)]/10">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[var(--status-processing)]" />
                  <span className="text-sm">معلّقة</span>
                </div>
                <span className="font-mono font-bold text-[var(--status-processing)]">{analytics.pendingCount}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الزبائن الفريدون</span>
                <span className="font-mono font-bold">{analytics.uniqueCustomers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الزبائن العائدون</span>
                <span className="font-mono font-bold text-primary">{analytics.repeatRate}%</span>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </StaggerContainer>
    </RoleGuard>
  )
}
