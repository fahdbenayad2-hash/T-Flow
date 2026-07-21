import { PackageOpen, ShoppingCart, Users, Phone, Search, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <motion.div
        className="rounded-2xl bg-muted p-5 mb-5"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {icon || <PackageOpen className="h-7 w-7 text-muted-foreground" />}
      </motion.div>
      <h3 className="text-base font-semibold mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}

export function OrdersEmptyState() {
  return (
    <EmptyState
      icon={<ShoppingCart className="h-7 w-7 text-muted-foreground" />}
      title="لا توجد طلبات"
      description="لم يتم العثور على طلبات مطابقة للفلتر المحدد"
    />
  )
}

export function CustomersEmptyState() {
  return (
    <EmptyState
      icon={<Users className="h-7 w-7 text-muted-foreground" />}
      title="لا يوجد عملاء"
      description="لم يتم العثور على عملاء مطابقين للبحث"
    />
  )
}

export function CallCenterEmptyState() {
  return (
    <EmptyState
      icon={<Phone className="h-7 w-7 text-muted-foreground" />}
      title="لا توجد مكالمات معلقة"
      description="تمت معالجة جميع الطلبات في الطابور"
    />
  )
}

export function SearchEmptyState({ query }: { query: string }) {
  return (
    <EmptyState
      icon={<Search className="h-7 w-7 text-muted-foreground" />}
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
    <motion.div
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="rounded-2xl bg-destructive/10 p-5 mb-5">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <h3 className="text-base font-semibold mb-1.5">حدث خطأ</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-5 leading-relaxed">
        {message || 'فشل تحميل البيانات. تحقق من اتصالك بالإنترنت وأعد المحاولة.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all duration-200 active:scale-[0.97]"
        >
          أعد المحاولة
        </button>
      )}
    </motion.div>
  )
}
