import { STATUS_MAP } from '~/lib/sheet-mapping'

const STATUS_COLORS: Record<string, string> = {
  'جاري التجهيز': '#f59e0b',
  'قيد المعالجة': '#f59e0b',
  'مؤكد': '#3b82f6',
  'مشحون': '#8b5cf6',
  'تم التسليم': '#22c55e',
  'ما جاوبش': '#f97316',
  'ملغي': '#6b7280',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] || '#6b7280'

  return (
    <span
      className={`inline-flex items-center gap-[5px] px-2 py-0.5 rounded-full text-[11px] font-semibold ${className || ''}`}
      style={{
        backgroundColor: `${color}1f`,
        color,
      }}
    >
      <span className="h-[5px] w-[5px] rounded-full shrink-0" style={{ background: color }} />
      {status}
    </span>
  )
}
