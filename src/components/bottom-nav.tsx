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
import { motion } from 'framer-motion'
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
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface-1/90 backdrop-blur-xl border-t border-border z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {visibleItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className="relative flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-[3.5rem]"
            >
              <span
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
              </span>
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors duration-200',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-5 h-[2px] bg-primary rounded-full"
                  layoutId="bottomnav-indicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
