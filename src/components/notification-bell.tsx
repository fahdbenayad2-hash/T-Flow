import { Bell, Radio } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { useNotifications } from '~/hooks/useNotifications'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

export function NotificationBell() {
  const { data: notifications, realtimeEnabled } = useNotifications()
  const count = notifications?.length || 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-3 py-2 text-sm font-semibold border-b flex items-center justify-between">
          <span>التنبيهات</span>
          {realtimeEnabled && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--status-delivered)]">
              <Radio className="h-3 w-3" />
              مباشر
            </span>
          )}
        </div>
        {count === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            لا توجد تنبيهات
          </div>
        ) : (
          notifications?.map((n, i) => (
            <DropdownMenuItem key={i} className="flex flex-col items-start gap-1 py-2">
              <span className="text-sm font-medium">{n.message}</span>
              {n.createdAt && (
                <span className="text-xs text-muted-foreground">{n.createdAt}</span>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
