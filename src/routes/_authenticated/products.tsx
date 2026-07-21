import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useOrders } from '~/lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { motion } from 'framer-motion'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import {
  Search,
  Package,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  BarChart3,
} from 'lucide-react'
import { STATUS_MAP, formatCurrency } from '~/lib/utils'
import { StaggerContainer, StaggerItem, FadeIn } from '~/components/page-transition'
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
    const name = order['المنتج']
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
    p.totalRevenue += (Number(order['السعر']) || 0) * (Number(order['الكمية']) || 1)

    if (order['الحالة'] === 'تم التسليم') p.deliveredOrders++
    else if (order['الحالة'] === 'ملغي') p.cancelledOrders++
    else if (['قيد المعالجة', 'جاري التجهيز'].includes(order['الحالة'])) p.pendingOrders++

    if (order['اللون']) p.colors.add(order['اللون'])
    if (order['المقاس']) p.sizes.add(order['المقاس'])
  }

  return Array.from(map.values())
    .map((p) => ({ ...p, avgPrice: p.totalOrders > 0 ? Math.round(p.totalRevenue / p.totalOrders) : 0 }))
    .sort((a, b) => b.totalOrders - a.totalOrders)
}

function ProductsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 skeleton-shimmer rounded-lg" /></CardContent></Card>
        ))}
      </div>
      <Skeleton className="h-10 skeleton-shimmer rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-40 skeleton-shimmer rounded-lg" />
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

  return (
    <RoleGuard roles={['admin']}>
    <StaggerContainer className="space-y-4">
      <FadeIn>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">المنتجات</span>
              </div>
              <p className="text-2xl font-bold font-mono">{products.length}</p>
            </CardContent>
            <div className="h-[3px] bg-primary" />
          </Card>
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="h-4 w-4 text-[var(--status-confirmed)]" />
                <span className="text-xs text-muted-foreground">إجمالي الطلبات</span>
              </div>
              <p className="text-2xl font-bold font-mono">{totalOrders}</p>
            </CardContent>
            <div className="h-[3px] bg-status-confirmed" />
          </Card>
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-[var(--status-delivered)]" />
                <span className="text-xs text-muted-foreground">إجمالي الإيرادات</span>
              </div>
              <p className="text-2xl font-bold font-mono">{formatCurrency(totalRevenue)}</p>
            </CardContent>
            <div className="h-[3px] bg-status-delivered" />
          </Card>
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-[var(--status-processing)]" />
                <span className="text-xs text-muted-foreground">متوسط السعر</span>
              </div>
              <p className="text-2xl font-bold font-mono">
                {totalOrders > 0 ? formatCurrency(Math.round(totalRevenue / totalOrders)) : '0 دج'}
              </p>
            </CardContent>
            <div className="h-[3px] bg-status-processing" />
          </Card>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث في المنتجات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
      </FadeIn>

      {filteredProducts.length === 0 ? (
        <FadeIn delay={0.2}>
          <EmptyState
            icon={<Package className="h-8 w-8 text-muted-foreground" />}
            title="لا توجد منتجات"
            description={search ? `لم يتم العثور على منتجات بـ "${search}"` : 'لا توجد بيانات منتجات بعد'}
          />
        </FadeIn>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((product, i) => {
            const deliveryRate = product.totalOrders > 0
              ? Math.round((product.deliveredOrders / product.totalOrders) * 100)
              : 0
            const revenuePercent = totalRevenue > 0
              ? Math.round((product.totalRevenue / totalRevenue) * 100)
              : 0

            return (
              <FadeIn key={product.name} delay={0.15 + i * 0.05}>
                <Card className="transition-all duration-200 overflow-hidden card-hover">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{product.name}</CardTitle>
                      <Badge className="text-xs" style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
                        {product.totalOrders} طلب
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">الإيرادات</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-[var(--status-delivered)] rounded-full"
                            style={{ width: `${revenuePercent}%` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${revenuePercent}%` }}
                            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                          />
                        </div>
                        <span className="font-mono text-sm font-bold">{formatCurrency(product.totalRevenue)}</span>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">تم التسليم</p>
                        <p className="font-mono font-bold text-[var(--status-delivered)]">{product.deliveredOrders}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">قيد الانتظار</p>
                        <p className="font-mono font-bold text-[var(--status-processing)]">{product.pendingOrders}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">ملغي</p>
                        <p className="font-mono font-bold text-[var(--status-cancelled)]">{product.cancelledOrders}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>متوسط السعر: {formatCurrency(product.avgPrice)}</span>
                      <span>نسبة التسليم: {deliveryRate}%</span>
                    </div>
                    {(product.colors.size > 0 || product.sizes.size > 0) && (
                      <>
                        <Separator />
                        <div className="flex flex-wrap gap-1">
                          {Array.from(product.colors).map((c) => (
                            <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                          ))}
                          {Array.from(product.sizes).map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </FadeIn>
            )
          })}
        </div>
      )}
    </StaggerContainer>
    </RoleGuard>
  )
}
