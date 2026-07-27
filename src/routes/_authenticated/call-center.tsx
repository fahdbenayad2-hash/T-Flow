import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useOrders } from '~/lib/queries'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Phone, PhoneOff, Clock, CheckCircle, MessageSquare } from 'lucide-react'
import { STATUS } from '~/lib/sheet-mapping'
import { formatCurrency } from '~/lib/utils'

import { ErrorState, CallCenterEmptyState } from '~/components/empty-state'
import toast from 'react-hot-toast'

export const Route = createFileRoute('/_authenticated/call-center')({
  component: CallCenterPage,
})

interface CallCardState {
  [orderId: string]: {
    outcome: 'answered' | 'no_answer' | 'postponed' | ''
    note: string
    followUpDate: string
    followUpTime: string
  }
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return parts[0][0] + parts[1][0]
  return parts[0]?.slice(0, 2) || '??'
}

function CallCenterSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[110px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
      <div className="flex gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-9 w-28 rounded-[11px] skeleton-shimmer" />
        ))}
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-[140px] rounded-[15px] skeleton-shimmer" />
      ))}
    </div>
  )
}

function CallCenterPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const [callStates, setCallStates] = useState<CallCardState>({})
  const [activeTab, setActiveTab] = useState<'queue' | 'stats'>('queue')

  const orders = useMemo(() => data?.orders ?? [], [data])

  const queueOrders = useMemo(
    () =>
      orders.filter((o) => ([STATUS.PROCESSING, STATUS.PREPARING] as string[]).includes(o.status)),
    [orders],
  )

  const todayStats = useMemo(() => {
    const entries = Object.values(callStates)
    return {
      answered: entries.filter((e) => e.outcome === 'answered').length,
      noAnswer: entries.filter((e) => e.outcome === 'no_answer').length,
      postponed: entries.filter((e) => e.outcome === 'postponed').length,
      total: entries.filter((e) => e.outcome !== '').length,
    }
  }, [callStates])

  const updateCallState = (orderId: string, field: string, value: string) => {
    setCallStates((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        outcome: prev[orderId]?.outcome || '',
        note: prev[orderId]?.note || '',
        followUpDate: prev[orderId]?.followUpDate || '',
        followUpTime: prev[orderId]?.followUpTime || '',
        [field]: value,
      },
    }))
  }

  const handleSubmitCall = (orderId: string) => {
    const state = callStates[orderId]
    if (!state?.outcome) {
      toast.error('اختر نتيجة المكالمة')
      return
    }
    toast.success(
      state.outcome === 'answered'
        ? 'تم تسجيل الرد'
        : state.outcome === 'no_answer'
          ? 'تم تسجيل عدم الرد'
          : 'تم التأجيل',
    )
    setCallStates((prev) => {
      const next = { ...prev }
      delete next[orderId]
      return next
    })
  }

  if (isLoading) return <CallCenterSkeleton />

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    )
  }

  const kpis = [
    {
      label: 'في الطابور',
      value: queueOrders.length,
      accent: '#e31e24',
      iconBg: 'rgba(227,30,36,0.1)',
    },
    {
      label: 'ردّ اليوم',
      value: todayStats.answered,
      accent: '#22c55e',
      iconBg: 'rgba(34,197,94,0.12)',
    },
    {
      label: 'ما ردّش',
      value: todayStats.noAnswer,
      accent: '#f97316',
      iconBg: 'rgba(249,115,22,0.12)',
    },
    {
      label: 'مؤجّل',
      value: todayStats.postponed,
      accent: '#f59e0b',
      iconBg: 'rgba(245,158,11,0.12)',
    },
  ]

  const actionButtons = [
    { key: 'answered', label: 'ردّ', icon: CheckCircle, color: '#22c55e' },
    { key: 'no_answer', label: 'ما ردّش', icon: PhoneOff, color: '#f97316' },
    { key: 'postponed', label: 'مؤجّل', icon: Clock, color: '#f59e0b' },
  ] as const

  return (
    <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="relative overflow-hidden bg-card p-[18px] kpi-accent"
            style={{
              border: '1px solid var(--color-card-border)',
              borderRadius: 'var(--color-card-radius)',
              ['--kpi-color' as string]: kpi.accent,
            }}
          >
            <div className="text-[12.5px] text-muted-foreground font-medium">{kpi.label}</div>
            <div
              className="font-mono text-[30px] font-bold mt-1.5 tracking-tight"
              style={{ color: kpi.accent }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[14.5px] font-extrabold">طابور التأكيد</h3>
          <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
            {queueOrders.length}
          </span>
        </div>
        <div className="flex gap-2">
          {(['queue', 'stats'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="h-9 px-4 rounded-[11px] text-[12px] font-bold transition-all"
              style={{
                background: activeTab === tab ? 'var(--color-foreground)' : 'var(--color-card)',
                color:
                  activeTab === tab ? 'var(--color-background)' : 'var(--color-muted-foreground)',
                border: '1px solid var(--color-card-border)',
              }}
            >
              {tab === 'queue' ? `القائمة (${queueOrders.length})` : 'الإحصائيات'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'queue' && (
        <div className="flex flex-col gap-3">
          {queueOrders.length === 0 ? (
            <CallCenterEmptyState />
          ) : (
            queueOrders.map((order) => {
              const state = callStates[order.order_id]
              const selectedAction = actionButtons.find((a) => a.key === state?.outcome)
              const borderColor = selectedAction ? selectedAction.color : undefined

              return (
                <div
                  key={order._row}
                  className="dc-card p-4 transition-all duration-200"
                  style={
                    borderColor
                      ? { borderColor: `${borderColor}40`, boxShadow: `0 0 0 3px ${borderColor}0a` }
                      : undefined
                  }
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-[14px]"
                        style={{ background: 'linear-gradient(135deg, #e31e24, #7d1622)' }}
                      >
                        {getInitials(order.customerName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-[14px]">{order.customerName}</h3>
                          <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                            {order.status}
                          </span>
                        </div>
                        <p className="text-[12.5px] text-muted-foreground mb-1">
                          {order.product} — {order.color} — {order.size}
                        </p>
                        <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
                          <span dir="ltr" className="font-mono">
                            <Phone className="inline h-3 w-3 ml-1" />
                            {order.phone}
                          </span>
                          <span className="font-mono font-semibold text-foreground">
                            {formatCurrency(Number(order.price) || 0)}
                          </span>
                        </div>
                        {order.notes && (
                          <p className="text-[11.5px] text-muted-foreground mt-1">
                            <MessageSquare className="inline h-3 w-3 ml-1" />
                            {order.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="w-full md:w-72 space-y-3">
                      <div className="flex gap-2">
                        {actionButtons.map(({ key, label, icon: Icon, color }) => {
                          const isActive = state?.outcome === key
                          return (
                            <button
                              key={key}
                              onClick={() => updateCallState(order.order_id, 'outcome', key)}
                              className="flex-1 flex items-center justify-center gap-1 h-9 rounded-[11px] text-[12px] font-bold transition-all"
                              style={{
                                background: isActive ? color : 'transparent',
                                color: isActive ? '#fff' : color,
                                border: `1px solid ${color}`,
                              }}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {label}
                            </button>
                          )
                        })}
                      </div>

                      <Input
                        placeholder="ملاحظة..."
                        value={state?.note || ''}
                        onChange={(e) => updateCallState(order.order_id, 'note', e.target.value)}
                        className="h-9 rounded-[11px] text-[12px]"
                        style={borderColor ? { borderColor: `${borderColor}60` } : undefined}
                      />

                      {state?.outcome === 'postponed' && (
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={state.followUpDate || ''}
                            onChange={(e) =>
                              updateCallState(order.order_id, 'followUpDate', e.target.value)
                            }
                            className="h-9 rounded-[11px] text-[12px]"
                          />
                          <Input
                            type="time"
                            value={state.followUpTime || ''}
                            onChange={(e) =>
                              updateCallState(order.order_id, 'followUpTime', e.target.value)
                            }
                            className="h-9 rounded-[11px] text-[12px]"
                          />
                        </div>
                      )}

                      {state?.outcome && (
                        <Button
                          size="sm"
                          className="w-full h-9 rounded-[11px] font-bold text-[12px]"
                          onClick={() => handleSubmitCall(order.order_id)}
                        >
                          تسجيل
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="dc-card p-5">
            <h3 className="text-[14.5px] font-extrabold mb-4">إحصائيات اليوم</h3>
            <div className="flex flex-col gap-3.5">
              {[
                { label: 'إجمالي المكالمات', value: todayStats.total },
                {
                  label: 'نسبة الرد',
                  value: `${todayStats.total > 0 ? Math.round((todayStats.answered / todayStats.total) * 100) : 0}%`,
                  color: '#22c55e',
                },
                {
                  label: 'نسبة عدم الرد',
                  value: `${todayStats.total > 0 ? Math.round((todayStats.noAnswer / todayStats.total) * 100) : 0}%`,
                  color: '#f97316',
                },
                {
                  label: 'نسبة التأجيل',
                  value: `${todayStats.total > 0 ? Math.round((todayStats.postponed / todayStats.total) * 100) : 0}%`,
                  color: '#f59e0b',
                },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-[12.5px] text-muted-foreground">{item.label}</span>
                  <span
                    className="font-mono text-[13px] font-bold"
                    style={item.color ? { color: item.color } : undefined}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="dc-card p-5">
            <h3 className="text-[14.5px] font-extrabold mb-4">ملخص الطابور</h3>
            <div className="flex flex-col gap-3.5">
              <div className="flex justify-between items-center">
                <span className="text-[12.5px] text-muted-foreground">طلبات قيد المعالجة</span>
                <span className="font-mono text-[13px] font-bold">{queueOrders.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12.5px] text-muted-foreground">إجمالي الطلبات</span>
                <span className="font-mono text-[13px] font-bold">{orders.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12.5px] text-muted-foreground">نسبة المعالجة</span>
                <span className="font-mono text-[13px] font-bold">
                  {orders.length > 0
                    ? Math.round(((orders.length - queueOrders.length) / orders.length) * 100)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
