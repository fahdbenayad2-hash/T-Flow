import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  PhoneOff,
  RotateCcw,
  Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { CallCenterEmptyState, ErrorState } from '~/components/empty-state'
import { buildCallQueue, getTodayCallStats, type QueueBucket } from '~/lib/call-center-insights'
import { normalizeAlgerianPhone } from '~/lib/customer-insights'
import { useCallLogs, useOrders, useRecordCallLog, useUpdateOrder } from '~/lib/queries'
import { STATUS } from '~/lib/sheet-mapping'
import type { CallLog } from '~/lib/types'
import { cn, formatCurrency } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/call-center')({
  component: CallCenterPage,
})

interface CallCardState {
  outcome: CallLog['outcome'] | ''
  note: string
  followUpDate: string
  followUpTime: string
}

type CallStates = Record<string, CallCardState>
type QueueFilter = 'all' | QueueBucket

const EMPTY_CALL_STATE: CallCardState = {
  outcome: '',
  note: '',
  followUpDate: '',
  followUpTime: '',
}

const BUCKET_META: Record<QueueBucket, { label: string; className: string; icon: typeof Clock }> = {
  due: {
    label: 'متابعة مستحقة',
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
    icon: CalendarClock,
  },
  retry: {
    label: 'إعادة محاولة',
    className: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    icon: RotateCcw,
  },
  new: {
    label: 'اتصال جديد',
    className: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    icon: Phone,
  },
  scheduled: {
    label: 'موعد قادم',
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    icon: Clock,
  },
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return parts[0][0] + parts[1][0]
  return parts[0]?.slice(0, 2) || '??'
}

function formatFollowUp(value: string | null) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ar-DZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function CallCenterSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-[105px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
      <div className="h-12 rounded-[13px] skeleton-shimmer" />
      {[...Array(3)].map((_, index) => (
        <div key={index} className="h-[190px] rounded-[15px] skeleton-shimmer" />
      ))}
    </div>
  )
}

function CallCenterPage() {
  const ordersQuery = useOrders()
  const callLogsQuery = useCallLogs()
  const updateOrder = useUpdateOrder()
  const recordCall = useRecordCallLog()
  const [callStates, setCallStates] = useState<CallStates>({})
  const [activeTab, setActiveTab] = useState<'queue' | 'stats'>('queue')
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [search, setSearch] = useState('')
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null)

  const orders = useMemo(() => ordersQuery.data?.orders ?? [], [ordersQuery.data])
  const callLogs = useMemo(() => callLogsQuery.data ?? [], [callLogsQuery.data])
  const queue = useMemo(() => buildCallQueue(orders, callLogs), [orders, callLogs])
  const todayStats = useMemo(() => getTodayCallStats(callLogs), [callLogs])

  const filteredQueue = useMemo(() => {
    const query = search.trim().toLowerCase()
    return queue.filter((item) => {
      const matchesFilter = filter === 'all' || item.bucket === filter
      const matchesSearch =
        !query ||
        item.order.customerName.toLowerCase().includes(query) ||
        String(item.order.phone).includes(query) ||
        item.order.order_id.toLowerCase().includes(query)
      return matchesFilter && matchesSearch
    })
  }, [filter, queue, search])

  const updateCallState = (
    orderId: string,
    field: keyof CallCardState,
    value: CallCardState[keyof CallCardState],
  ) => {
    setCallStates((previous) => ({
      ...previous,
      [orderId]: {
        ...(previous[orderId] || EMPTY_CALL_STATE),
        [field]: value,
      },
    }))
  }

  const handleSubmitCall = async (item: (typeof queue)[number]) => {
    const { order } = item
    const state = callStates[order.order_id]

    if (!state?.outcome) {
      toast.error('اختر نتيجة المكالمة')
      return
    }

    let followUpAt: string | null = null
    if (state.outcome === 'postponed') {
      if (!state.followUpDate || !state.followUpTime) {
        toast.error('حدد تاريخ ووقت المتابعة')
        return
      }

      const followUpDate = new Date(`${state.followUpDate}T${state.followUpTime}`)
      // This check runs only after the user clicks save, not during rendering.
      // eslint-disable-next-line react-hooks/purity
      if (Number.isNaN(followUpDate.getTime()) || followUpDate.getTime() <= Date.now()) {
        toast.error('موعد المتابعة يجب أن يكون في المستقبل')
        return
      }
      followUpAt = followUpDate.toISOString()
    }

    setSubmittingOrderId(order.order_id)
    try {
      if (state.outcome !== 'postponed') {
        await updateOrder.mutateAsync({
          row: order._row,
          updates: {
            status: state.outcome === 'answered' ? STATUS.CONFIRMED : STATUS.NO_ANSWER,
          },
          lastModified: order.lastModified,
          order_id: order.order_id,
          phone: String(order.phone),
          product: order.product,
        })
      }

      await recordCall.mutateAsync({
        orderId: order.order_id,
        outcome: state.outcome,
        note: state.note,
        followUpAt,
      })

      toast.success(
        state.outcome === 'answered'
          ? 'تم تأكيد الطلب وتسجيل المكالمة'
          : state.outcome === 'no_answer'
            ? 'تم تسجيل عدم الرد'
            : 'تم حفظ موعد المتابعة',
      )
      setCallStates((previous) => {
        const next = { ...previous }
        delete next[order.order_id]
        return next
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ نتيجة المكالمة')
    } finally {
      setSubmittingOrderId(null)
    }
  }

  if (ordersQuery.isLoading || callLogsQuery.isLoading) return <CallCenterSkeleton />

  if (ordersQuery.isError || callLogsQuery.isError) {
    const error = ordersQuery.error || callLogsQuery.error
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => {
          ordersQuery.refetch()
          callLogsQuery.refetch()
        }}
      />
    )
  }

  const queueCounts: Record<QueueFilter, number> = {
    all: queue.length,
    due: queue.filter((item) => item.bucket === 'due').length,
    retry: queue.filter((item) => item.bucket === 'retry').length,
    new: queue.filter((item) => item.bucket === 'new').length,
    scheduled: queue.filter((item) => item.bucket === 'scheduled').length,
  }

  const kpis = [
    {
      label: 'جاهز للاتصال',
      value: queueCounts.due + queueCounts.retry + queueCounts.new,
      color: '#e31e24',
    },
    { label: 'تم تأكيده اليوم', value: todayStats.answered, color: '#22c55e' },
    { label: 'لم يرد اليوم', value: todayStats.noAnswer, color: '#f97316' },
    { label: 'متابعة مجدولة', value: queueCounts.scheduled, color: '#f59e0b' },
  ]

  const filters: Array<{ value: QueueFilter; label: string }> = [
    { value: 'all', label: 'الكل' },
    { value: 'due', label: 'مستحق الآن' },
    { value: 'retry', label: 'إعادة محاولة' },
    { value: 'new', label: 'جديد' },
    { value: 'scheduled', label: 'مجدول' },
  ]

  const actions = [
    { value: 'answered' as const, label: 'مؤكد', icon: CheckCircle2, color: '#22c55e' },
    { value: 'no_answer' as const, label: 'ما ردّش', icon: PhoneOff, color: '#f97316' },
    { value: 'postponed' as const, label: 'تأجيل', icon: Clock, color: '#f59e0b' },
  ]

  return (
    <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="relative overflow-hidden bg-card p-4 md:p-[18px] kpi-accent"
            style={{
              border: '1px solid var(--color-card-border)',
              borderRadius: 'var(--color-card-radius)',
              ['--kpi-color' as string]: kpi.color,
            }}
          >
            <div className="text-[11.5px] md:text-[12.5px] text-muted-foreground font-medium">
              {kpi.label}
            </div>
            <div
              className="font-mono text-[26px] md:text-[30px] font-bold mt-1.5 tracking-tight"
              style={{ color: kpi.color }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className="dc-card overflow-hidden">
        <div className="p-4 md:p-5 border-b border-border/70">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-extrabold">مساحة عمل التأكيد</h3>
                {queueCounts.due > 0 && (
                  <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500">
                    {queueCounts.due} مستحق
                  </span>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground mt-1">
                مكالمات مرتبة حسب الأولوية مع سجل محفوظ في Supabase
              </p>
            </div>

            <div className="flex rounded-xl border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className={cn(
                  'inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[11.5px] font-bold transition-colors',
                  activeTab === 'queue'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground',
                )}
              >
                <Phone className="h-3.5 w-3.5" />
                الطابور
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('stats')}
                className={cn(
                  'inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[11.5px] font-bold transition-colors',
                  activeTab === 'stats'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground',
                )}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                أداء اليوم
              </button>
            </div>
          </div>

          {activeTab === 'queue' && (
            <>
              <div className="relative mt-4">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ابحث بالاسم، الهاتف أو رقم الطلب..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="ps-10 h-11 rounded-xl border-border bg-muted/35"
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
                      {queueCounts[item.value]}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {activeTab === 'queue' ? (
          <div className="p-3 md:p-4">
            {filteredQueue.length === 0 ? (
              search || filter !== 'all' ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="rounded-2xl bg-muted p-5 mb-4">
                    <Search className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold">لا توجد مكالمات مطابقة</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    جرّب تغيير البحث أو فئة الطابور
                  </p>
                </div>
              ) : (
                <CallCenterEmptyState />
              )
            ) : (
              <div className="flex flex-col gap-3">
                {filteredQueue.map((item) => {
                  const { order } = item
                  const state = callStates[order.order_id] || EMPTY_CALL_STATE
                  const bucket = BUCKET_META[item.bucket]
                  const BucketIcon = bucket.icon
                  const normalizedPhone = normalizeAlgerianPhone(String(order.phone))
                  const isSubmitting = submittingOrderId === order.order_id

                  return (
                    <div
                      key={order.order_id}
                      className={cn(
                        'rounded-2xl border bg-card p-4 transition-colors',
                        item.bucket === 'due'
                          ? 'border-red-500/25'
                          : 'border-border/80 hover:border-border',
                      )}
                    >
                      <div className="flex flex-col xl:flex-row gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                              style={{ background: 'linear-gradient(135deg, #e31e24, #7d1622)' }}
                            >
                              {getInitials(order.customerName)}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-extrabold text-[14px]">{order.customerName}</h4>
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold',
                                    bucket.className,
                                  )}
                                >
                                  <BucketIcon className="h-3 w-3" />
                                  {bucket.label}
                                </span>
                                {item.attempts > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {item.attempts} محاولة سابقة
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11.5px] text-muted-foreground">
                                <span>{order.product}</span>
                                <span>{formatCurrency(Number(order.price) || 0)}</span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {order.wilaya}، {order.baladiya}
                                </span>
                              </div>

                              {item.latestLog?.follow_up_at && (
                                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/8 px-2.5 py-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                  <CalendarClock className="h-3.5 w-3.5" />
                                  {formatFollowUp(item.latestLog.follow_up_at)}
                                </div>
                              )}

                              {item.latestLog?.note && (
                                <p className="mt-2 text-[11.5px] text-muted-foreground">
                                  <MessageSquare className="me-1 inline h-3 w-3" />
                                  آخر ملاحظة: {item.latestLog.note}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-2 mt-3">
                                <a
                                  href={`tel:${normalizedPhone}`}
                                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-[11.5px] font-bold text-primary-foreground"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                  اتصال
                                  <span dir="ltr" className="font-mono opacity-80">
                                    {order.phone}
                                  </span>
                                </a>
                                <a
                                  href={`https://wa.me/${normalizedPhone.replace('+', '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-500/25 px-3 text-[11.5px] font-bold text-emerald-500"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  واتساب
                                </a>
                                <Link
                                  to="/orders/$row"
                                  params={{ row: String(order._row) }}
                                  className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  تفاصيل الطلب
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </Link>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="xl:w-[360px] rounded-2xl bg-muted/25 p-3">
                          <p className="text-[10.5px] font-bold text-muted-foreground mb-2">
                            نتيجة المكالمة
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {actions.map((action) => {
                              const Icon = action.icon
                              const isActive = state.outcome === action.value
                              return (
                                <button
                                  key={action.value}
                                  type="button"
                                  onClick={() =>
                                    updateCallState(order.order_id, 'outcome', action.value)
                                  }
                                  className="flex h-9 items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition-all"
                                  style={{
                                    color: isActive ? '#fff' : action.color,
                                    background: isActive ? action.color : 'transparent',
                                    border: `1px solid ${action.color}55`,
                                  }}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                  {action.label}
                                </button>
                              )
                            })}
                          </div>

                          <Input
                            placeholder="ملاحظة المكالمة..."
                            value={state.note}
                            onChange={(event) =>
                              updateCallState(order.order_id, 'note', event.target.value)
                            }
                            className="h-9 mt-2 rounded-xl bg-background text-[11.5px]"
                          />

                          {state.outcome === 'postponed' && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <Input
                                aria-label="تاريخ المتابعة"
                                type="date"
                                value={state.followUpDate}
                                onChange={(event) =>
                                  updateCallState(
                                    order.order_id,
                                    'followUpDate',
                                    event.target.value,
                                  )
                                }
                                className="h-9 rounded-xl bg-background text-[11px]"
                              />
                              <Input
                                aria-label="وقت المتابعة"
                                type="time"
                                value={state.followUpTime}
                                onChange={(event) =>
                                  updateCallState(
                                    order.order_id,
                                    'followUpTime',
                                    event.target.value,
                                  )
                                }
                                className="h-9 rounded-xl bg-background text-[11px]"
                              />
                            </div>
                          )}

                          <Button
                            type="button"
                            size="sm"
                            disabled={!state.outcome || isSubmitting}
                            onClick={() => handleSubmitCall(item)}
                            className="w-full h-9 mt-2 rounded-xl text-[11.5px] font-bold"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                جاري الحفظ...
                              </>
                            ) : (
                              'حفظ النتيجة'
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 md:p-5">
            <div className="rounded-2xl border border-border/80 p-4">
              <h4 className="text-[13px] font-extrabold">نتائج اليوم</h4>
              <div className="space-y-3 mt-4">
                {[
                  { label: 'إجمالي المكالمات', value: todayStats.total },
                  { label: 'طلبات مؤكدة', value: todayStats.answered, color: '#22c55e' },
                  { label: 'لم يرد', value: todayStats.noAnswer, color: '#f97316' },
                  { label: 'متابعة مؤجلة', value: todayStats.postponed, color: '#f59e0b' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5"
                  >
                    <span className="text-[12px] text-muted-foreground">{item.label}</span>
                    <span
                      className="font-mono text-[14px] font-bold"
                      style={item.color ? { color: item.color } : undefined}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 p-4">
              <h4 className="text-[13px] font-extrabold">مؤشرات الأداء</h4>
              <div className="space-y-4 mt-4">
                {[
                  {
                    label: 'نسبة التأكيد',
                    value:
                      todayStats.total > 0
                        ? Math.round((todayStats.answered / todayStats.total) * 100)
                        : 0,
                    color: '#22c55e',
                  },
                  {
                    label: 'نسبة عدم الرد',
                    value:
                      todayStats.total > 0
                        ? Math.round((todayStats.noAnswer / todayStats.total) * 100)
                        : 0,
                    color: '#f97316',
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-mono font-bold">{item.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${item.value}%`, background: item.color }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-border/70">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-muted-foreground">متبقي في الطابور</span>
                    <span className="font-mono font-bold">{queue.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
