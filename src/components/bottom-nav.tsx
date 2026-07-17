import { Link, useLocation } from '@tanstack/react-router'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Phone,
} from 'lucide-react'
import { cn } from '~/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { to: '/orders', label: 'الطلبات', icon: ShoppingCart },
  { to: '/customers', label: 'العملاء', icon: Users },
  { to: '/call-center', label: 'المكالمات', icon: Phone },
]

export function BottomNav() {
  const location = useLocation()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-background border-t border-border z-50">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
