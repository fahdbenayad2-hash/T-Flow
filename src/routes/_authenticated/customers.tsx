import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useOrders } from '~/lib/queries'
import { Card, CardContent } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Search,
  Users,
  ShoppingCart,
} from 'lucide-react'
import type { Order, Customer } from '~/lib/types'
import { formatCurrency } from '~/lib/utils'
import { StaggerContainer, StaggerItem, FadeIn } from '~/components/page-transition'
import { ErrorState, CustomersEmptyState } from '~/components/empty-state'

export const Route = createFileRoute('/_authenticated/customers')({
  component: CustomersPage,
})

function aggregateCustomers(orders: Order[]): Customer[] {
  const map = new Map<string, Customer>()

  for (const order of orders) {
    const phone = String(order['الهاتف'])
    if (!phone) continue

    if (!map.has(phone)) {
      map.set(phone, {
        phone,
        name: order['الاسم'],
        orders: [],
        totalOrders: 0,
        totalSpent: 0,
        cancelledCount: 0,
        noAnswerCount: 0,
        lastOrderDate: order['التاريخ'],
        isBlacklisted: false,
      })
    }

    const customer = map.get(phone)!
    customer.orders.push(order)
    customer.totalOrders++
    customer.totalSpent += (Number(order['السعر']) || 0) * (Number(order['الكمية']) || 1)

    if (order['الحالة'] === 'ملغي') customer.cancelledCount++
    if (order['الحالة'] === 'ما جاوبش') customer.noAnswerCount++

    if (order['التاريخ'] > customer.lastOrderDate) {
      customer.lastOrderDate = order['التاريخ']
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalOrders - a.totalOrders)
}

function CustomersSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 skeleton-shimmer rounded-lg" /></CardContent></Card>
        ))}
      </div>
      <Skeleton className="h-10 skeleton-shimmer rounded-lg" />
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-14 skeleton-shimmer rounded-lg" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
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
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q)
    )
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

  return (
    <StaggerContainer className="space-y-4">
      <FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">إجمالي العملاء</span>
              </div>
              <p className="text-2xl font-bold font-mono">{customers.length}</p>
            </CardContent>
            <div className="h-[3px] bg-primary" />
          </Card>
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="h-4 w-4 text-[var(--status-confirmed)]" />
                <span className="text-xs text-muted-foreground">متوسط الطلبات للعميل</span>
              </div>
              <p className="text-2xl font-bold font-mono">{avgOrders}</p>
            </CardContent>
            <div className="h-[3px] bg-[var(--status-confirmed)]" />
          </Card>
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">إجمالي الإنفاق</span>
              </div>
              <p className="text-2xl font-bold font-mono">{formatCurrency(totalRevenue)}</p>
            </CardContent>
            <div className="h-[3px] bg-[var(--status-delivered)]" />
          </Card>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
      </FadeIn>

      {filteredCustomers.length === 0 ? (
        <FadeIn delay={0.2}>
          {search ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">لا توجد نتائج</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                لم يتم العثور على عملاء بـ "{search}"
              </p>
            </div>
          ) : (
            <CustomersEmptyState />
          )}
        </FadeIn>
      ) : (
        <FadeIn delay={0.2}>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-right font-medium text-xs text-muted-foreground">الاسم</th>
                  <th className="p-3 text-right font-medium text-xs text-muted-foreground">الهاتف</th>
                  <th className="p-3 text-right font-medium text-xs text-muted-foreground">عدد الطلبات</th>
                  <th className="p-3 text-right font-medium text-xs text-muted-foreground">إجمالي الإنفاق</th>
                  <th className="p-3 text-right font-medium text-xs text-muted-foreground">إلغاء</th>
                  <th className="p-3 text-right font-medium text-xs text-muted-foreground">ما جاوبش</th>
                  <th className="p-3 text-right font-medium text-xs text-muted-foreground">آخر طلب</th>
                  <th className="p-3 text-right font-medium text-xs text-muted-foreground">الملف</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer, i) => (
                  <tr
                    key={customer.phone}
                    className="border-b last:border-0 table-row-hover"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <td className="p-3 font-medium">{customer.name}</td>
                    <td className="p-3 font-mono text-xs" dir="ltr">{customer.phone}</td>
                    <td className="p-3 font-mono text-center">{customer.totalOrders}</td>
                    <td className="p-3 font-mono text-xs">{formatCurrency(customer.totalSpent)}</td>
                    <td className="p-3 text-center">
                      {customer.cancelledCount > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">{customer.cancelledCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {customer.noAnswerCount > 0 ? (
                        <Badge className="text-[10px] bg-[var(--status-no-answer)] text-white">{customer.noAnswerCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{customer.lastOrderDate.slice(0, 12)}</td>
                    <td className="p-3">
                      <Link
                        to="/customers/$phone"
                        params={{ phone: customer.phone }}
                        className="text-primary hover:underline text-sm"
                      >
                        عرض
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.25}>
        <p className="text-xs text-muted-foreground text-center">
          {filteredCustomers.length} عميل من {customers.length}
        </p>
      </FadeIn>
    </StaggerContainer>
  )
}
