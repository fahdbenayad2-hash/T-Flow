import { PackageOpen, ShoppingCart, Users, Phone, Search, AlertTriangle } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        {icon || <PackageOpen className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function OrdersEmptyState() {
  return (
    <EmptyState
      icon={<ShoppingCart className="h-8 w-8 text-muted-foreground" />}
      title="لا توجد طلبات"
      description="لم يتم العثور على طلبات مطابقة للفلتر المحدد"
    />
  )
}

export function CustomersEmptyState() {
  return (
    <EmptyState
      icon={<Users className="h-8 w-8 text-muted-foreground" />}
      title="لا يوجد عملاء"
      description="لم يتم العثور على عملاء مطابقين للبحث"
    />
  )
}

export function CallCenterEmptyState() {
  return (
    <EmptyState
      icon={<Phone className="h-8 w-8 text-muted-foreground" />}
      title="لا توجد مكالمات معلقة"
      description="تمت معالجة جميع الطلبات في الطابور"
    />
  )
}

export function SearchEmptyState({ query }: { query: string }) {
  return (
    <EmptyState
      icon={<Search className="h-8 w-8 text-muted-foreground" />}
      title="لا توجد نتائج"
      description={`لم يتم العثور على نتائج لـ "${query}"`}
    />
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-1">حدث خطأ</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        {message || 'فشل تحميل البيانات. تحقق من اتصالك بالإنترنت وأعد المحاولة.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          أعد المحاولة
        </button>
      )}
    </div>
  )
}
