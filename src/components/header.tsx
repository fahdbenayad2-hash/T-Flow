import { Menu, X, LogOut, Moon, Sun, Shield } from 'lucide-react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { NotificationBell } from '~/components/notification-bell'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useRole, getRoleLabel } from '~/hooks/useRole'
import { supabase } from '~/utils/supabase-client'
import { cn } from '~/lib/utils'
import { navItems } from '~/components/sidebar'
import type { AppRole } from '~/lib/types'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { roles, isAdmin } = useRole()

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles) return true
    return item.roles.some((r) => roles.includes(r))
  })

  const allItems = [
    ...visibleNavItems,
    ...(isAdmin ? [{ to: '/users', label: 'إدارة المستخدمين', icon: Shield }] : []),
  ]

  const handleLogout = async () => {
    setMobileMenuOpen(false)
    await supabase.auth.signOut()
    navigate({ to: '/' })
  }

  const primaryRole = roles[0]

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-surface-0/80 backdrop-blur-xl px-4 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>

        <div className="flex-1">
          <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        </div>

        <div className="flex items-center gap-1.5">
          <NotificationBell />
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={cn(
          'fixed top-0 right-0 z-[60] h-full w-72 bg-surface-1 border-r border-border shadow-2xl transform transition-transform duration-300 ease-out md:hidden',
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-3 px-5 border-b border-border">
          <img src="/logo.png" alt="T-Flow" className="h-7 w-7 object-contain shrink-0" />
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-primary">T</span>-Flow
          </h1>
        </div>

        <nav
          className="flex-1 px-3 py-4 space-y-1 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 12rem)' }}
        >
          {allItems.map((item) => {
            const isActive = location.pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-l-full" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border space-y-1 bg-surface-1">
          {primaryRole && (
            <div className="px-3 py-1.5">
              <Badge className="text-[10px] text-white bg-primary border-transparent gap-1">
                <Shield className="h-3 w-3" />
                {getRoleLabel(primaryRole)}
              </Badge>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            خروج
          </Button>
        </div>
      </div>
    </>
  )
}
