import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useOrders } from '~/lib/queries'
import { Package } from 'lucide-react'
import { formatCurrency } from '~/lib/utils'
import { ErrorState, EmptyState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'
import type { Order } from '~/lib/types'

export const Route = createFileRoute('/_authenticated/products')({
  component: ProductsPage,
})

interface ProductStats {
  name: string
  totalOrders: number
  totalUnits: number
  totalRevenue: number
  colors: Set<string>
}

function aggregateProducts(orders: Order[]): ProductStats[] {
  const map = new Map<string, ProductStats>()

  for (const order of orders) {
    const name = order.product
    if (!name) continue

    if (!map.has(name)) {
      map.set(name, {
        name,
        totalOrders: 0,
        totalUnits: 0,
        totalRevenue: 0,
        colors: new Set(),
      })
    }

    const p = map.get(name)!
    p.totalOrders++
    p.totalUnits += Number(order.quantity) || 1
    p.totalRevenue += (Number(order.price) || 0) * (Number(order.quantity) || 1)

    if (order.color) p.colors.add(order.color)
  }

  return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue)
}

function ProductsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[200px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
    </div>
  )
}

function ProductsPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()

  const orders = useMemo(() => data?.orders ?? [], [data])
  const products = useMemo(() => aggregateProducts(orders), [orders])

  const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0)

  if (isLoading) return <ProductsSkeleton />

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    )
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-8 w-8 text-muted-foreground" />}
        title="لا توجد منتجات"
      />
    )
  }

  return (
    <RoleGuard roles={['admin']}>
      <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((product, i) => {
            const revenuePercent =
              totalRevenue > 0 ? Math.round((product.totalRevenue / totalRevenue) * 100) : 0

            return (
              <div key={product.name} className="dc-card p-5 card-hover relative">
                <div
                  className="absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center font-mono text-[11px] font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, #e31e24, #7d1622)' }}
                >
                  #{i + 1}
                </div>

                <div className="mb-3 pe-10">
                  <h3 className="text-[14.5px] font-extrabold">{product.name}</h3>
                </div>

                {product.colors.size > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {Array.from(product.colors).map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center h-5 px-2 rounded-full border border-divider text-[10px] text-muted-foreground"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11.5px] text-muted-foreground">الإيرادات</span>
                      <span className="font-mono text-[12px] font-bold">{revenuePercent}%</span>
                    </div>
                    <div className="h-[7px] bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${revenuePercent}%`,
                          background: 'linear-gradient(90deg, #7d1622, #e31e24)',
                          transformOrigin: 'right',
                          animation: 'tfGrow 0.8s ease both',
                        }}
                      />
                    </div>
                    <div className="font-mono text-[14px] font-bold mt-1">
                      {formatCurrency(product.totalRevenue)}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                    <span className="font-mono font-semibold text-foreground">
                      {product.totalOrders}
                    </span>{' '}
                    طلب
                    <span className="font-mono font-semibold text-foreground">
                      {product.totalUnits}
                    </span>{' '}
                    وحدة
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </RoleGuard>
  )
}
