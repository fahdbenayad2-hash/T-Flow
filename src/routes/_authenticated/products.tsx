import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Package,
  PackageCheck,
  Pencil,
  Search,
  ShoppingBag,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState, ErrorState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  aggregateProductInventory,
  type InventoryHealth,
  type ProductInventoryStats,
} from '~/lib/product-inventory'
import { useInventorySettings, useOrders, useUpdateInventorySetting } from '~/lib/queries'
import { cn, formatCurrency } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/products')({
  component: ProductsPage,
})

type InventoryFilter = 'all' | InventoryHealth

const HEALTH_META: Record<
  InventoryHealth,
  { label: string; className: string; icon: typeof Package }
> = {
  healthy: {
    label: 'مخزون جيد',
    className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    icon: CheckCircle2,
  },
  low: {
    label: 'مخزون منخفض',
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    icon: AlertTriangle,
  },
  out_of_stock: {
    label: 'نفد المخزون',
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
    icon: Package,
  },
  untracked: {
    label: 'غير مضبوط',
    className: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    icon: Boxes,
  },
}

function ProductsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-[105px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
      <div className="h-48 rounded-[15px] skeleton-shimmer" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-[210px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
    </div>
  )
}

function ProductsPage() {
  const ordersQuery = useOrders()
  const inventoryQuery = useInventorySettings()
  const updateInventory = useUpdateInventorySetting()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<InventoryFilter>('all')
  const [editingProduct, setEditingProduct] = useState<ProductInventoryStats | null>(null)
  const [stockQuantity, setStockQuantity] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState('5')
  const [unitCost, setUnitCost] = useState('')

  const orders = useMemo(() => ordersQuery.data?.orders ?? [], [ordersQuery.data])
  const settings = useMemo(() => inventoryQuery.data ?? [], [inventoryQuery.data])
  const products = useMemo(() => aggregateProductInventory(orders, settings), [orders, settings])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products.filter((product) => {
      const matchesSearch = !query || product.name.toLowerCase().includes(query)
      const matchesFilter = filter === 'all' || product.health === filter
      return matchesSearch && matchesFilter
    })
  }, [filter, products, search])

  const openInventoryEditor = (product: ProductInventoryStats) => {
    setEditingProduct(product)
    setStockQuantity(String(product.stockQuantity ?? ''))
    setLowStockThreshold(String(product.lowStockThreshold))
    setUnitCost(String(product.unitCost || ''))
  }

  const saveInventory = async () => {
    if (!editingProduct) return
    if (stockQuantity.trim() === '') {
      toast.error('أدخل رصيد المخزون الحالي')
      return
    }

    try {
      await updateInventory.mutateAsync({
        productName: editingProduct.name,
        stockQuantity: Number(stockQuantity),
        lowStockThreshold: Number(lowStockThreshold),
        unitCost: Number(unitCost),
      })
      toast.success('تم تحديث مخزون المنتج')
      setEditingProduct(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تحديث المخزون')
    }
  }

  if (ordersQuery.isLoading || inventoryQuery.isLoading) return <ProductsSkeleton />

  if (ordersQuery.isError || inventoryQuery.isError) {
    const error = ordersQuery.error || inventoryQuery.error
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => {
          ordersQuery.refetch()
          inventoryQuery.refetch()
        }}
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

  const trackedProducts = products.filter((product) => product.stockQuantity !== null)
  const availableUnits = trackedProducts.reduce(
    (total, product) => total + (product.availableUnits || 0),
    0,
  )
  const reservedUnits = products.reduce((total, product) => total + product.reservedUnits, 0)
  const alertCount = products.filter(
    (product) => product.health === 'low' || product.health === 'out_of_stock',
  ).length
  const inventoryValue = trackedProducts.reduce(
    (total, product) => total + (product.inventoryValue || 0),
    0,
  )

  const kpis = [
    { label: 'إجمالي المنتجات', value: products.length, icon: Boxes, color: 'text-sky-500' },
    {
      label: 'وحدات متوفرة',
      value: availableUnits,
      icon: PackageCheck,
      color: 'text-emerald-500',
    },
    { label: 'وحدات محجوزة', value: reservedUnits, icon: ShoppingBag, color: 'text-amber-500' },
    {
      label: 'تنبيهات المخزون',
      value: alertCount,
      icon: AlertTriangle,
      color: alertCount > 0 ? 'text-red-500' : 'text-muted-foreground',
    },
  ]

  const filters: Array<{ value: InventoryFilter; label: string; count: number }> = [
    { value: 'all', label: 'الكل', count: products.length },
    {
      value: 'healthy',
      label: 'جيد',
      count: products.filter((product) => product.health === 'healthy').length,
    },
    {
      value: 'low',
      label: 'منخفض',
      count: products.filter((product) => product.health === 'low').length,
    },
    {
      value: 'out_of_stock',
      label: 'نافد',
      count: products.filter((product) => product.health === 'out_of_stock').length,
    },
    {
      value: 'untracked',
      label: 'غير مضبوط',
      count: products.filter((product) => product.health === 'untracked').length,
    },
  ]

  return (
    <RoleGuard roles={['admin']}>
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
                <div className="font-mono text-[26px] md:text-[30px] font-bold tracking-tight">
                  {kpi.value}
                </div>
                <div className="rounded-xl bg-muted p-2">
                  <kpi.icon className={cn('h-4 w-4', kpi.color)} />
                </div>
              </div>
              <div className="text-[11.5px] md:text-[12.5px] text-muted-foreground font-medium mt-1">
                {kpi.label}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.65fr] gap-4">
          <div className="dc-card p-4 md:p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-extrabold">مراقبة المخزون</h3>
                <p className="text-[12px] text-muted-foreground mt-1">
                  المتوفر = الرصيد الحالي ناقص الوحدات المحجوزة
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {trackedProducts.length} من {products.length} مضبوط
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-muted/35 p-3">
                <p className="font-mono text-xl font-bold">{availableUnits}</p>
                <p className="text-[10.5px] text-muted-foreground mt-1">متوفر للبيع</p>
              </div>
              <div className="rounded-2xl bg-muted/35 p-3">
                <p className="font-mono text-xl font-bold">{reservedUnits}</p>
                <p className="text-[10.5px] text-muted-foreground mt-1">محجوز للطلبات</p>
              </div>
              <div className="rounded-2xl bg-muted/35 p-3">
                <p className="font-mono text-base md:text-xl font-bold">
                  {formatCurrency(inventoryValue)}
                </p>
                <p className="text-[10.5px] text-muted-foreground mt-1">قيمة المخزون</p>
              </div>
            </div>
          </div>

          <div
            className={cn(
              'rounded-[var(--color-card-radius)] border p-4 md:p-5',
              alertCount > 0
                ? 'border-amber-500/25 bg-amber-500/5'
                : 'border-emerald-500/20 bg-emerald-500/5',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'rounded-xl p-2.5',
                  alertCount > 0
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-emerald-500/10 text-emerald-500',
                )}
              >
                {alertCount > 0 ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="text-[14px] font-extrabold">
                  {alertCount > 0 ? `${alertCount} تنبيه يحتاج الانتباه` : 'المخزون في حالة جيدة'}
                </h3>
                <p className="text-[11.5px] text-muted-foreground mt-1 leading-5">
                  {products.some((product) => product.health === 'untracked')
                    ? 'اضبط رصيد المنتجات غير المتتبعة للحصول على تنبيهات دقيقة.'
                    : 'سيظهر التنبيه هنا قبل وصول أي منتج إلى حد النفاد.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="dc-card overflow-hidden">
          <div className="p-4 md:p-5 border-b border-border/70">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-extrabold">كتالوج المنتجات</h3>
                <p className="text-[12px] text-muted-foreground mt-1">
                  أداء المبيعات وحالة المخزون في مكان واحد
                </p>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ابحث عن منتج..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 ps-10 rounded-xl bg-muted/35"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
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
                  <span className="font-mono text-[10px] opacity-75">{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 md:p-4">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="rounded-2xl bg-muted p-5 mb-4">
                  <Search className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">لا توجد منتجات مطابقة</h3>
                <p className="text-sm text-muted-foreground mt-1">جرّب تغيير البحث أو الفئة</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {filteredProducts.map((product) => {
                  const health = HEALTH_META[product.health]
                  const HealthIcon = health.icon
                  const stockProgress =
                    product.stockQuantity && product.stockQuantity > 0
                      ? Math.round(((product.availableUnits || 0) / product.stockQuantity) * 100)
                      : 0

                  return (
                    <div
                      key={product.name}
                      className="rounded-2xl border border-border/80 bg-card p-4 transition-colors hover:border-border"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-[14px] font-extrabold">{product.name}</h4>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold',
                                health.className,
                              )}
                            >
                              <HealthIcon className="h-3 w-3" />
                              {health.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {product.colors.slice(0, 4).map((color) => (
                              <span
                                key={color}
                                className="rounded-full border border-border px-2 py-0.5 text-[9.5px] text-muted-foreground"
                              >
                                {color}
                              </span>
                            ))}
                            {product.sizes.slice(0, 3).map((size) => (
                              <span
                                key={size}
                                className="rounded-full bg-muted px-2 py-0.5 text-[9.5px] text-muted-foreground"
                              >
                                {size}
                              </span>
                            ))}
                          </div>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant={product.health === 'untracked' ? 'default' : 'outline'}
                          onClick={() => openInventoryEditor(product)}
                          className="h-8 shrink-0 rounded-xl px-3 text-[10.5px]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {product.health === 'untracked' ? 'ضبط المخزون' : 'تعديل'}
                        </Button>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mt-4">
                        <div className="rounded-xl bg-muted/30 p-2.5">
                          <p className="font-mono text-[16px] font-bold">
                            {product.availableUnits ?? '—'}
                          </p>
                          <p className="text-[9.5px] text-muted-foreground mt-1">متوفر</p>
                        </div>
                        <div className="rounded-xl bg-muted/30 p-2.5">
                          <p className="font-mono text-[16px] font-bold">{product.reservedUnits}</p>
                          <p className="text-[9.5px] text-muted-foreground mt-1">محجوز</p>
                        </div>
                        <div className="rounded-xl bg-muted/30 p-2.5">
                          <p className="font-mono text-[16px] font-bold">
                            {product.deliveredUnits}
                          </p>
                          <p className="text-[9.5px] text-muted-foreground mt-1">مباع</p>
                        </div>
                        <div className="rounded-xl bg-muted/30 p-2.5">
                          <p className="font-mono text-[16px] font-bold">{product.totalOrders}</p>
                          <p className="text-[9.5px] text-muted-foreground mt-1">طلبات</p>
                        </div>
                      </div>

                      {product.stockQuantity !== null && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-[10.5px]">
                            <span className="text-muted-foreground">المخزون المتبقي</span>
                            <span className="font-mono font-bold">{stockProgress}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                product.health === 'healthy'
                                  ? 'bg-emerald-500'
                                  : product.health === 'low'
                                    ? 'bg-amber-500'
                                    : 'bg-red-500',
                              )}
                              style={{ width: `${stockProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-end justify-between gap-3 mt-4 pt-3 border-t border-border/70">
                        <div>
                          <p className="text-[9.5px] text-muted-foreground">إجمالي المبيعات</p>
                          <p className="font-mono text-[13px] font-bold mt-1">
                            {formatCurrency(product.totalRevenue)}
                          </p>
                        </div>
                        {product.inventoryValue !== null && product.unitCost > 0 && (
                          <div className="text-left">
                            <p className="text-[9.5px] text-muted-foreground">قيمة المتوفر</p>
                            <p className="font-mono text-[13px] font-bold mt-1">
                              {formatCurrency(product.inventoryValue)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={editingProduct !== null}
        onOpenChange={(open) => {
          if (!open) setEditingProduct(null)
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-primary" />
              ضبط مخزون {editingProduct?.name}
            </DialogTitle>
            <DialogDescription>
              أدخل الرصيد الموجود حاليًا. سيطرح T-Flow منه الوحدات المحجوزة تلقائيًا.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="stock-quantity">رصيد المخزون الحالي</Label>
              <Input
                id="stock-quantity"
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(event) => setStockQuantity(event.target.value)}
                placeholder="مثال: 50"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="low-stock-threshold">حد التنبيه</Label>
                <Input
                  id="low-stock-threshold"
                  type="number"
                  min="0"
                  value={lowStockThreshold}
                  onChange={(event) => setLowStockThreshold(event.target.value)}
                  placeholder="5"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit-cost">تكلفة الوحدة</Label>
                <Input
                  id="unit-cost"
                  type="number"
                  min="0"
                  value={unitCost}
                  onChange={(event) => setUnitCost(event.target.value)}
                  placeholder="0 دج"
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingProduct(null)}
              disabled={updateInventory.isPending}
            >
              إلغاء
            </Button>
            <Button type="button" onClick={saveInventory} disabled={updateInventory.isPending}>
              {updateInventory.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                'حفظ المخزون'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  )
}
