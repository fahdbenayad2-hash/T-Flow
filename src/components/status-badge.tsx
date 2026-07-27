import { Badge } from '~/components/ui/badge'
import { STATUS_MAP } from '~/lib/sheet-mapping'
import { cn } from '~/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusInfo = STATUS_MAP[status as keyof typeof STATUS_MAP]
  return (
    <Badge
      className={cn('text-[10px]', className)}
      style={{
        backgroundColor: `var(${statusInfo?.cssVar || '--status-processing'})`,
        color: 'var(--color-primary-foreground)',
      }}
    >
      {status}
    </Badge>
  )
}
