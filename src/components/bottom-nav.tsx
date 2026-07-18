import { Link, useLocation } from '@tanstack/react-router'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Phone,
  Settings,
} from 'lucide-react'
import { cn } from '~/lib/utils'
import { useRole } from '~/hooks/useRole'
import type { AppRole } from '~/lib/types'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  roles?: AppRole[]
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { to: '/orders', label: 'الطلبات', icon: ShoppingCart },
  { to: '/customers', label: 'العملاء', icon: Users },
  { to: '/call-center', label: 'المكالمات', icon: Phone },
  { to: '/settings', label: 'الإعدادات', icon: Settings, roles: ['admin'] },
]

export function BottomNav() {
  const location = useLocation()
  const { roles } = useRole()

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true
    return item.roles.some((r) => roles.includes(r))
  })

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border z-50">
      <div className="flex items-center justify-around h-16 px-1">
        {visibleItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors duration-200 min-w-[3.75rem]',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-full transition-colors duration-200',
                  isActive && 'bg-primary/10'
                )}
              >
                <item.icon className="h-5 w-5" />
              </span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
