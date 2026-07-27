import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useOrders } from '~/lib/queries'
import { Input } from '~/components/ui/input'
import { Package, ShoppingCart, DollarSign, BarChart3 } from 'lucide-react'
import { formatCurrency } from '~/lib/utils'
import { STATUS } from '~/lib/sheet-mapping'
import { ErrorState, EmptyState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'

export const Route = createFileRoute('/_authenticated/products')({
  component: ProductsPage,
})

interface ProductStats {
  name: string
  totalOrders: number
  totalRevenue: number
  deliveredOrders: number
  cancelledOrders: number
  pendingOrders: number
  avgPrice: number
  colors: Set<string>
  sizes: Set<string>
}

function aggregateProducts(orders: any[]): ProductStats[] {
  const map = new Map<string, ProductStats>()

  for (const order of orders) {
    const name = order.product
    if (!name) continue

    if (!map.has(name)) {
      map.set(name, {
        name,
        totalOrders: 0,
        totalRevenue: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        pendingOrders: 0,
        avgPrice: 0,
        colors: new Set(),
        sizes: new Set(),
      })
    }

    const p = map.get(name)!
    p.totalOrders++
    p.totalRevenue += (Number(order.price) || 0) * (Number(order.quantity) || 1)

    if (order.status === STATUS.DELIVERED) p.deliveredOrders++
    else if (order.status === STATUS.CANCELLED) p.cancelledOrders++
    else if ([STATUS.PROCESSING, STATUS.PREPARING].includes(order.status)) p.pendingOrders++

    if (order.color) p.colors.add(order.color)
    if (order.size) p.sizes.add(order.size)
  }

  return Array.from(map.values())
    .map((p) => ({
      ...p,
      avgPrice: p.totalOrders > 0 ? Math.round(p.totalRevenue / p.totalOrders) : 0,
    }))
    .sort((a, b) => b.totalOrders - a.totalOrders)
}

function ProductsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[110px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
      <div className="h-10 rounded-[11px] skeleton-shimmer" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[220px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
    </div>
  )
}

function ProductsPage() {
  const { data, isLoading, isError, error, refetch } = useOrders()
  const [search, setSearch] = useState('')

  const orders = data?.orders || []
  const products = useMemo(() => aggregateProducts(orders), [orders])

  const filteredProducts = useMemo(() => {
    if (!search) return products
    const q = search.toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(q))
  }, [products, search])

  const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0)
  const totalOrders = products.reduce((sum, p) => sum + p.totalOrders, 0)

  if (isLoading) return <ProductsSkeleton />

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    )
  }

  const kpis = [
    { label: 'المنتجات', value: products.length, accent: '#e31e24', icon: Package },
    { label: 'إجمالي الطلبات', value: totalOrders, accent: '#3b82f6', icon: ShoppingCart },
    { label: 'إجمالي الإيرادات', value: formatCurrency(totalRevenue), accent: '#22c55e', icon: DollarSign },
    { label: 'متوسط السعر', value: totalOrders > 0 ? formatCurrency(Math.round(totalRevenue / totalOrders)) : '0 دج', accent: '#f59e0b', icon: BarChart3 },
  ]

  return (
    <RoleGuard roles={['admin']}>
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
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[12.5px] text-muted-foreground font-medium">{kpi.label}</div>
                  <div className="font-mono text-[26px] font-bold mt-1.5 tracking-tight">{kpi.value}</div>
                </div>
                <div
                  className="flex items-center justify-center w-[34px] h-[34px] rounded-[10px] shrink-0"
                  style={{ background: `${kpi.accent}1a` }}
                >
                  <kpi.icon className="w-[16px] h-[16px]" style={{ color: kpi.accent }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="relative">
          <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">⌕</span>
          <Input
            placeholder="بحث في المنتجات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="start-9 h-10 rounded-[11px] border-border"
          />
        </div>

        {filteredProducts.length === 0 ? (
          <EmptyState
            icon={<Package className="h-8 w-8 text-muted-foreground" />}
            title="لا توجد منتجات"
            description={search ? `لم يتم العثور على منتجات بـ "${search}"` : 'لا توجد بيانات منتجات بعد'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProducts.map((product) => {
              const deliveryRate = product.totalOrders > 0 ? Math.round((product.deliveredOrders / product.totalOrders) * 100) : 0
              const revenuePercent = totalRevenue > 0 ? Math.round((product.totalRevenue / totalRevenue) * 100) : 0

              return (
                <div key={product.name} className="dc-card p-5 card-hover">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[14px] font-extrabold">{product.name}</h3>
                    <span className="inline-flex items-center h-5 px-2 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {product.totalOrders} طلب
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-muted-foreground">الإيرادات</span>
                      <div className="flex items-center gap-2 flex-1 ms-3">
                        <div className="flex-1 h-[6px] bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--status-delivered)] rounded-full"
                            style={{
                              width: `${revenuePercent}%`,
                              transformOrigin: 'right',
                              animation: 'tfGrow 0.8s ease both',
                            }}
                          />
                        </div>
                        <span className="font-mono text-[12px] font-bold shrink-0">{formatCurrency(product.totalRevenue)}</span>
                      </div>
                    </div>

                    <div className="h-px bg-[var(--color-divider)]" />

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10.5px] text-muted-foreground">تم التسليم</p>
                        <p className="font-mono text-[13px] font-bold text-[var(--status-delivered)]">{product.deliveredOrders}</p>
                      </div>
                      <div>
                        <p className="text-[10.5px] text-muted-foreground">قيد الانتظار</p>
                        <p className="font-mono text-[13px] font-bold text-[var(--status-processing)]">{product.pendingOrders}</p>
                      </div>
                      <div>
                        <p className="text-[10.5px] text-muted-foreground">ملغي</p>
                        <p className="font-mono text-[13px] font-bold text-[var(--status-cancelled)]">{product.cancelledOrders}</p>
                      </div>
                    </div>

                    <div className="h-px bg-[var(--color-divider)]" />

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>متوسط السعر: {formatCurrency(product.avgPrice)}</span>
                      <span>نسبة التسليم: {deliveryRate}%</span>
                    </div>

                    {(product.colors.size > 0 || product.sizes.size > 0) && (
                      <>
                        <div className="h-px bg-[var(--color-divider)]" />
                        <div className="flex flex-wrap gap-1">
                          {Array.from(product.colors).map((c) => (
                            <span key={c} className="inline-flex items-center h-5 px-2 rounded-full border border-divider text-[10px] text-muted-foreground">
                              {c}
                            </span>
                          ))}
                          {Array.from(product.sizes).map((s) => (
                            <span key={s} className="inline-flex items-center h-5 px-2 rounded-full border border-divider text-[10px] text-muted-foreground">
                              {s}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </RoleGuard>
  )
}
