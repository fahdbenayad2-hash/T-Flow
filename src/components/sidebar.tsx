import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Phone,
  Moon,
  Sun,
  LogOut,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import { supabase } from '~/utils/supabase-client'

const navItems = [
  { to: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { to: '/orders', label: 'الطلبات', icon: ShoppingCart },
  { to: '/customers', label: 'العملاء', icon: Users },
  { to: '/call-center', label: 'مركز المكالمات', icon: Phone },
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate({ to: '/auth' })
  }

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar-background text-sidebar-foreground">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-primary">T</span>-Flow
        </h1>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
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
