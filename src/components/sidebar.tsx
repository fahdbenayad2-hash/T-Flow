import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Phone,
  Moon,
  Sun,
  LogOut,
  Settings,
  Package,
  DollarSign,
  Truck,
  BarChart3,
  Shield,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'
import { supabase } from '~/utils/supabase-client'
import { motion } from 'framer-motion'
import { useRole, getRoleLabel } from '~/hooks/useRole'
import type { AppRole } from '~/lib/types'

export interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  roles?: AppRole[]
}

export const navItems: NavItem[] = [
  { to: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { to: '/orders', label: 'الطلبات', icon: ShoppingCart },
  { to: '/customers', label: 'العملاء', icon: Users },
  { to: '/call-center', label: 'مركز المكالمات', icon: Phone },
  { to: '/products', label: 'المنتجات', icon: Package, roles: ['admin'] },
  { to: '/earnings', label: 'الإيرادات', icon: DollarSign, roles: ['admin'] },
  { to: '/delivery', label: 'التوصيل', icon: Truck, roles: ['admin', 'shipping_manager'] },
  { to: '/reports', label: 'التقارير', icon: BarChart3, roles: ['admin'] },
  { to: '/settings', label: 'الإعدادات', icon: Settings, roles: ['admin'] },
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { roles, isAdmin } = useRole()

  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles) return true
    return item.roles.some((r) => roles.includes(r))
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate({ to: '/' })
  }

  const primaryRole = roles[0]

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar-background text-sidebar-foreground border-l border-sidebar-border">
      <div className="relative flex h-14 items-center gap-2.5 px-5 border-b border-sidebar-border overflow-hidden">
        <div className="absolute inset-0 brand-speedlines pointer-events-none opacity-60" />
        <motion.img
          src="/logo.png"
          alt="T-Flow"
          className="relative h-7 w-7 object-contain shrink-0"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        />
        <motion.h1
          className="relative text-lg font-bold tracking-tight"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className="text-primary">T</span>-Flow
        </motion.h1>
      </div>

      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map((item, i) => {
          const isActive = location.pathname.startsWith(item.to)
          return (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
            >
              <Link
                to={item.to}
                className={cn(
                  'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
                {isActive && (
                  <motion.div
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-l-full"
                    layoutId="sidebar-indicator"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            </motion.div>
          )
        })}

        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: visibleNavItems.length * 0.03 }}
          >
            <Link
              to="/users"
              className={cn(
                'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                location.pathname.startsWith('/users')
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
              )}
            >
              <Shield className="h-4.5 w-4.5 shrink-0" />
              إدارة المستخدمين
            </Link>
          </motion.div>
        )}
      </nav>

      <div className="p-2.5 border-t border-sidebar-border space-y-0.5">
        {primaryRole && (
          <div className="px-2.5 py-1.5">
            <Badge className="text-[10px] text-white bg-primary border-transparent gap-1">
              <Shield className="h-3 w-3" />
              {getRoleLabel(primaryRole)}
            </Badge>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          خروج
        </Button>
      </div>
    </aside>
  )
}
