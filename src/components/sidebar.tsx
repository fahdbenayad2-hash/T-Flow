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

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  roles?: AppRole[]
}

const navItems: NavItem[] = [
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
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar-background text-sidebar-foreground">
      <div className="relative flex h-16 items-center gap-2.5 px-6 border-b border-sidebar-border overflow-hidden">
        <div className="absolute inset-0 brand-speedlines pointer-events-none" />
        <motion.img
          src="/logo.png"
          alt="T-Flow"
          className="relative h-8 w-8 object-contain shrink-0"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        />
        <motion.h1
          className="relative text-xl font-bold tracking-tight"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className="text-primary">T</span>-Flow
        </motion.h1>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item, i) => {
          const isActive = location.pathname.startsWith(item.to)
          return (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Link
                to={item.to}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {isActive && (
                  <motion.div
                    className="absolute right-0 w-1 h-6 bg-primary rounded-l-full"
                    layoutId="sidebar-indicator"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </Link>
            </motion.div>
          )
        })}

        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: visibleNavItems.length * 0.05 }}
          >
            <Link
              to="/users"
              className={cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                location.pathname.startsWith('/users')
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <Shield className="h-5 w-5" />
              إدارة المستخدمين
            </Link>
          </motion.div>
        )}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        {primaryRole && (
          <div className="px-3 py-2">
            <Badge className="text-[10px] text-white bg-primary border-transparent">
              <Shield className="h-3 w-3 ml-1" />
              {getRoleLabel(primaryRole)}
            </Badge>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 ml-2" /> : <Moon className="h-4 w-4 ml-2" />}
          {theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 ml-2" />
          خروج
        </Button>
      </div>
    </aside>
  )
}
