import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useOrders } from '~/lib/queries'
import { Input } from '~/components/ui/input'
import {
  CheckCircle2,
  ChevronLeft,
  MessageCircle,
  Phone,
  Search,
  ShieldAlert,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { cn, formatCurrency } from '~/lib/utils'
import { ErrorState, CustomersEmptyState } from '~/components/empty-state'
import {
  aggregateCustomers,
  getCustomerInsight,
  normalizeAlgerianPhone,
  type CustomerSegment,
} from '~/lib/customer-insights'

export const Route = createFileRoute('/_authenticated/customers')({
  component: CustomersPage,
})

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return parts[0][0] + parts[1][0]
  return parts[0]?.slice(0, 2) || '??'
}

function CustomersSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-[100px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
      <div className="h-10 rounded-[11px] skeleton-shimmer" />
      <div className="flex flex-col gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[72px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
    </div>
  )
}

function CustomersPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<'all' | CustomerSegment>('all')

  const orders = useMemo(() => data?.orders ?? [], [data])
  const customers = useMemo(() => aggregateCustomers(orders), [orders])

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase()
    return customers.filter((customer) => {
      const matchesSearch =
        !q || customer.name.toLowerCase().includes(q) || customer.phone.includes(q)
      const matchesSegment = segment === 'all' || getCustomerInsight(customer).segment === segment
      return matchesSearch && matchesSegment
    })
  }, [customers, search, segment])

  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0)
  const customerInsights = customers.map(getCustomerInsight)
  const repeatCustomers = customers.filter((customer) => customer.totalOrders > 1).length
  const deliveredOrders = customerInsights.reduce((sum, insight) => sum + insight.deliveredCount, 0)
  const completedOrders = customerInsights.reduce(
    (sum, insight) => sum + insight.deliveredCount + insight.failedCount,
    0,
  )
  const deliveryRate =
    completedOrders > 0 ? `${Math.round((deliveredOrders / completedOrders) * 100)}%` : '—'
  const followUpCount = customerInsights.filter(
    (insight) => insight.segment === 'needs_follow_up',
  ).length

  if (isLoading) return <CustomersSkeleton />

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    )
  }

  const kpis = [
    { label: 'إجمالي العملاء', value: customers.length, icon: UsersRound, tone: 'text-sky-500' },
    {
      label: 'قيمة الطلبات',
      value: formatCurrency(totalRevenue),
      icon: Sparkles,
      tone: 'text-amber-500',
    },
    {
      label: 'عملاء متكررون',
      value: repeatCustomers,
      icon: CheckCircle2,
      tone: 'text-emerald-500',
    },
    { label: 'نسبة التوصيل', value: deliveryRate, icon: ShieldAlert, tone: 'text-primary' },
  ]

  const filters: Array<{ value: 'all' | CustomerSegment; label: string; count: number }> = [
    { value: 'all', label: 'الكل', count: customers.length },
    {
      value: 'loyal',
      label: 'موثوقون',
      count: customerInsights.filter((i) => i.segment === 'loyal').length,
    },
    {
      value: 'needs_follow_up',
      label: 'يحتاجون متابعة',
      count: followUpCount,
    },
    {
      value: 'new',
      label: 'جدد',
      count: customerInsights.filter((i) => i.segment === 'new').length,
    },
  ]

  return (
    <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="relative overflow-hidden bg-card p-4 md:p-[18px]"
            style={{
              border: '1px solid var(--color-card-border)',
              borderRadius: 'var(--color-card-radius)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-mono text-[24px] md:text-[30px] font-bold tracking-tight">
                {kpi.value}
              </div>
              <div className="rounded-xl bg-muted p-2">
                <kpi.icon className={cn('h-4 w-4', kpi.tone)} />
              </div>
            </div>
            <div className="text-[12.5px] text-muted-foreground font-medium mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="dc-card overflow-hidden">
        <div className="p-4 md:p-5 border-b border-border/70">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-extrabold">مركز العملاء الذكي</h3>
                {followUpCount > 0 && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    {followUpCount} للمتابعة
                  </span>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground mt-1">
                سجل موحّد يساعدك على معرفة العميل قبل الاتصال
              </p>
            </div>
            <span className="text-[11px] text-muted-foreground">مرتّبة حسب قيمة الطلبات</span>
          </div>

          <div className="relative mt-4">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-10 h-11 rounded-xl border-border bg-muted/35"
            />
          </div>

          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setSegment(filter.value)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors',
                  segment === filter.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                {filter.label}
                <span
                  className={cn(
                    'font-mono text-[10px]',
                    segment === filter.value
                      ? 'text-primary-foreground/75'
                      : 'text-muted-foreground',
                  )}
                >
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 md:p-4">
          {filteredCustomers.length === 0 ? (
            <div>
              {search || segment !== 'all' ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="rounded-2xl bg-muted p-5 mb-4">
                    <Search className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold mb-1">لا توجد نتائج مطابقة</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    جرّب تغيير البحث أو اختيار فئة أخرى
                  </p>
                </div>
              ) : (
                <CustomersEmptyState />
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredCustomers.map((customer) => {
                const insight = getCustomerInsight(customer)
                const normalizedPhone = normalizeAlgerianPhone(customer.phone)
                const segmentClasses = {
                  loyal: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                  needs_follow_up: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                  new: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
                }

                return (
                  <div
                    key={customer.phone}
                    className="group flex items-center gap-3 rounded-2xl border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/25"
                  >
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-[13px]"
                      style={{ background: 'linear-gradient(135deg, #e31e24, #7d1622)' }}
                    >
                      {getInitials(customer.name)}
                    </div>

                    <Link
                      to="/customers/$phone"
                      params={{ phone: customer.phone }}
                      className="flex-1 min-w-0"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[13.5px] truncate">{customer.name}</span>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-bold',
                            segmentClasses[insight.segment],
                          )}
                        >
                          {insight.segmentLabel}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11.5px] text-muted-foreground">
                        <span dir="ltr" className="font-mono">
                          {customer.phone}
                        </span>
                        <span>{customer.totalOrders} طلب</span>
                        <span>{formatCurrency(customer.totalSpent)}</span>
                        {insight.deliveredCount > 0 && <span>{insight.deliveryRate}% توصيل</span>}
                      </div>
                    </Link>

                    <div className="hidden sm:flex items-center gap-1 shrink-0">
                      <a
                        href={`https://wa.me/${normalizedPhone.replace('+', '')}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`مراسلة ${customer.name} عبر واتساب`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-emerald-500 transition-colors hover:bg-emerald-500/10"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                      <a
                        href={`tel:${normalizedPhone}`}
                        aria-label={`الاتصال بـ ${customer.name}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-sky-500 transition-colors hover:bg-sky-500/10"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                      <Link
                        to="/customers/$phone"
                        params={{ phone: customer.phone }}
                        aria-label={`فتح ملف ${customer.name}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground">
        عرض <b className="text-foreground">{filteredCustomers.length}</b> عميل من {customers.length}
      </p>
    </div>
  )
}
