import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useOrders } from '~/lib/queries'
import { Input } from '~/components/ui/input'
import { Search } from 'lucide-react'
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

  const orders = useMemo(() => data?.orders ?? [], [data])
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
    { label: 'العملاء', value: customers.length },
    { label: 'إجمالي الإنفاق', value: formatCurrency(totalRevenue) },
    { label: 'متوسط الطلبات', value: avgOrders },
  ]

  return (
    <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="relative overflow-hidden bg-card p-[18px]"
            style={{
              border: '1px solid var(--color-card-border)',
              borderRadius: 'var(--color-card-radius)',
            }}
          >
            <div className="font-mono text-[30px] font-bold tracking-tight">{kpi.value}</div>
            <div className="text-[12.5px] text-muted-foreground font-medium mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-[14.5px] font-extrabold">قاعدة العملاء</h3>
        <span className="text-[12px] text-muted-foreground">مرتّبة حسب الإنفاق</span>
      </div>

      <div className="relative">
        <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          ⌕
        </span>
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
        <div className="flex flex-col gap-3">
          {filteredCustomers.map((customer) => (
            <Link
              key={customer.phone}
              to="/customers/$phone"
              params={{ phone: customer.phone }}
              className="dc-card p-4 flex items-center gap-4 card-hover"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-[15px]"
                style={{ background: 'linear-gradient(135deg, #e31e24, #7d1622)' }}
              >
                {getInitials(customer.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[14px] truncate">{customer.name}</span>
                  {customer.isBlacklisted && (
                    <span className="inline-flex items-center h-5 px-2 rounded-full bg-[var(--status-cancelled)]/15 text-[var(--status-cancelled)] text-[10px] font-bold shrink-0">
                      محظور
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[12px] text-muted-foreground">
                  <span dir="ltr" className="font-mono">
                    {customer.phone}
                  </span>
                  <span>{customer.totalOrders} طلب</span>
                  <span>{customer.name.split(' ')[0]}</span>
                </div>
              </div>
              <div className="text-left shrink-0">
                <div className="font-mono text-[14px] font-bold">
                  {formatCurrency(customer.totalSpent)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-[12px] text-muted-foreground">
        عرض <b className="text-foreground">{filteredCustomers.length}</b> عميل من {customers.length}
      </p>
    </div>
  )
}
