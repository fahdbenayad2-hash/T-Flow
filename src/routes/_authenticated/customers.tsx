import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useOrders } from '~/lib/queries'
import { Input } from '~/components/ui/input'
import { Search, Users, ShoppingCart, DollarSign } from 'lucide-react'
import type { Order, Customer } from '~/lib/types'
import { formatCurrency } from '~/lib/utils'
import { STATUS } from '~/lib/sheet-mapping'
import { ErrorState, CustomersEmptyState } from '~/components/empty-state'


export const Route = createFileRoute('/_authenticated/customers')({
  component: CustomersPage,
})

function aggregateCustomers(orders: Order[]): Customer[] {
  const map = new Map<string, Customer>()

  for (const order of orders) {
    const phone = String(order.phone)
    if (!phone) continue

    if (!map.has(phone)) {
      map.set(phone, {
        phone,
        name: order.customerName,
        orders: [],
        totalOrders: 0,
        totalSpent: 0,
        cancelledCount: 0,
        noAnswerCount: 0,
        lastOrderDate: order.date,
        isBlacklisted: false,
      })
    }

    const customer = map.get(phone)!
    customer.orders.push(order)
    customer.totalOrders++
    customer.totalSpent += (Number(order.price) || 0) * (Number(order.quantity) || 1)

    if (order.status === STATUS.CANCELLED) customer.cancelledCount++
    if (order.status === STATUS.NO_ANSWER) customer.noAnswerCount++

    if (order.date > customer.lastOrderDate) {
      customer.lastOrderDate = order.date
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalOrders - a.totalOrders)
}

function CustomersSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-[110px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
      <div className="h-10 rounded-[11px] skeleton-shimmer" />
      <div className="h-[400px] rounded-[15px] skeleton-shimmer" />
    </div>
  )
}

function CustomersPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const [search, setSearch] = useState('')

  const orders = data?.orders || []
  const customers = useMemo(() => aggregateCustomers(orders), [orders])

  const filteredCustomers = useMemo(() => {
    if (!search) return customers
    const q = search.toLowerCase()
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q))
  }, [customers, search])

  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0)
  const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0)
  const avgOrders = customers.length > 0 ? (totalOrders / customers.length).toFixed(1) : '0'

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
    { label: 'إجمالي العملاء', value: customers.length, icon: Users, color: '#e31e24', accent: '#e31e24', iconBg: 'rgba(227,30,36,0.1)' },
    { label: 'متوسط الطلبات', value: avgOrders, icon: ShoppingCart, color: '#3b82f6', accent: '#3b82f6', iconBg: 'rgba(59,130,246,0.12)' },
    { label: 'إجمالي الإنفاق', value: formatCurrency(totalRevenue), icon: DollarSign, color: '#22c55e', accent: '#22c55e', iconBg: 'rgba(34,197,94,0.12)' },
  ]

  return (
    <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[12.5px] text-muted-foreground font-medium">{kpi.label}</div>
                <div className="font-mono text-[30px] font-bold mt-1.5 tracking-tight">{kpi.value}</div>
              </div>
              <div
                className="flex items-center justify-center w-[38px] h-[38px] rounded-[11px] shrink-0"
                style={{ background: kpi.iconBg }}
              >
                <kpi.icon className="w-[18px] h-[18px]" style={{ color: kpi.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative">
        <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">⌕</span>
        <Input
          placeholder="بحث بالاسم أو رقم الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="start-9 h-10 rounded-[11px] border-border"
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <div>
          {search ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-2xl bg-muted p-5 mb-4">
                <Search className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold mb-1">لا توجد نتائج</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                لم يتم العثور على عملاء بـ "{search}"
              </p>
            </div>
          ) : (
            <CustomersEmptyState />
          )}
        </div>
      ) : (
        <div className="dc-card overflow-hidden">
          <div
            className="flex items-center text-[11.5px] font-bold text-muted-foreground sticky top-0 z-10"
            style={{ background: 'var(--color-table-header)', borderBottom: '1px solid var(--color-table-border)' }}
          >
            <div className="px-3 py-3 flex-1 min-w-[130px]">الاسم</div>
            <div className="px-2 py-3 w-[120px] shrink-0">الهاتف</div>
            <div className="px-2 py-3 w-20 shrink-0 text-center">الطلبات</div>
            <div className="px-2 py-3 w-[104px] shrink-0">الإنفاق</div>
            <div className="px-2 py-3 w-16 shrink-0 text-center">إلغاء</div>
            <div className="px-2 py-3 w-16 shrink-0 text-center">ما جاوبش</div>
            <div className="px-2 py-3 w-[100px] shrink-0">آخر طلب</div>
            <div className="px-2 py-3 w-16 shrink-0">الملف</div>
          </div>
          <div className="overflow-auto max-h-[calc(100vh-22rem)]">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.phone}
                className="flex items-center text-[13px] border-b border-divider last:border-b-0 table-row-hover"
              >
                <div className="px-3 py-2.5 flex-1 min-w-[130px] font-bold truncate">{customer.name}</div>
                <div className="px-2 py-2.5 w-[120px] shrink-0 font-mono text-[11.5px] text-muted-foreground" dir="ltr">
                  {customer.phone}
                </div>
                <div className="px-2 py-2.5 w-20 shrink-0 font-mono text-center">{customer.totalOrders}</div>
                <div className="px-2 py-2.5 w-[104px] shrink-0 font-mono text-[12px] font-semibold">
                  {formatCurrency(customer.totalSpent)}
                </div>
                <div className="px-2 py-2.5 w-16 shrink-0 text-center">
                  {customer.cancelledCount > 0 ? (
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-[var(--status-cancelled)]/15 text-[var(--status-cancelled)] font-mono text-[10px] font-bold">
                      {customer.cancelledCount}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">-</span>
                  )}
                </div>
                <div className="px-2 py-2.5 w-16 shrink-0 text-center">
                  {customer.noAnswerCount > 0 ? (
                    <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-[var(--status-no-answer)]/15 text-[var(--status-no-answer)] font-mono text-[10px] font-bold">
                      {customer.noAnswerCount}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">-</span>
                  )}
                </div>
                <div className="px-2 py-2.5 w-[100px] shrink-0 font-mono text-[11px] text-muted-foreground">
                  {customer.lastOrderDate.slice(0, 12)}
                </div>
                <div className="px-2 py-2.5 w-16 shrink-0">
                  <Link
                    to="/customers/$phone"
                    params={{ phone: customer.phone }}
                    className="text-[#c41a1f] hover:underline font-semibold text-[11.5px]"
                  >
                    عرض
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[12px] text-muted-foreground">
        عرض <b className="text-foreground">{filteredCustomers.length}</b> عميل من {customers.length}
      </p>
    </div>
  )
}
