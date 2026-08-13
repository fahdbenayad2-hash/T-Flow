import { AlertTriangle, Bell, CircleAlert, Info, Radio } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'
import { useNotifications } from '~/hooks/useNotifications'
import type { Notification } from '~/lib/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

export function NotificationBell() {
  const { data: notifications, realtimeEnabled } = useNotifications()
  const navigate = useNavigate()
  const count = notifications?.length || 0
  const criticalCount =
    notifications?.filter((notification) => notification.severity === 'critical').length || 0

  const openNotification = (notification: Notification) => {
    if (notification.destination === '/call-center') navigate({ to: '/call-center' })
    else if (notification.destination === '/products') navigate({ to: '/products' })
    else if (notification.destination === '/customers') navigate({ to: '/customers' })
    else if (notification.destination === '/delivery') navigate({ to: '/delivery' })
    else if (notification.destination === '/system-health') navigate({ to: '/system-health' })
    else navigate({ to: '/orders' })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="فتح التنبيهات">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span
              className={`absolute -top-1 -left-1 h-4 w-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
                criticalCount > 0 ? 'bg-destructive animate-pulse' : 'bg-amber-500'
              }`}
            >
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
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">لا توجد تنبيهات</div>
        ) : (
          notifications?.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              onSelect={() => openNotification(notification)}
              className="flex cursor-pointer items-start gap-2.5 py-2.5"
            >
              {notification.severity === 'critical' ? (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              ) : notification.severity === 'warning' ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              )}
              <div className="min-w-0">
                <span className="block text-[12px] font-bold">{notification.title}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {notification.message}
                </span>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
