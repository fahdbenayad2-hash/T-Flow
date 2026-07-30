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

const pageMeta: Record<string, [string, string]> = {
  '/dashboard': ['لوحة التحكم', 'نظرة عامة على أداء متجرك اليوم'],
  '/orders': ['الطلبات', 'إدارة وتتبع جميع الطلبات'],
  '/customers': ['العملاء', 'قاعدة بيانات الزبائن وسجل الشراء'],
  '/call-center': ['مركز المكالمات', 'طابور التأكيد ونتائج المكالمات'],
  '/products': ['المنتجات', 'أداء المنتجات والمخزون'],
  '/earnings': ['الإيرادات', 'التحليل المالي حسب المنتج والولاية'],
  '/delivery': ['التوصيل', 'توزيع الشحن حسب الولاية والنوع'],
  '/reports': ['التقارير', 'ملخصات وتصدير البيانات'],
  '/integrations': ['ربط المتاجر', 'استقبال الطلبات من المواقع الخارجية'],
  '/users': ['إدارة المستخدمين', 'الأدوار والصلاحيات'],
  '/settings': ['الإعدادات', 'إعداد الاتصال والمزامنة'],
}

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
    ...(isAdmin
      ? [
          {
            to: '/users',
            label: 'إدارة المستخدمين',
            icon: Shield,
            group: 'system' as const,
            roles: ['admin'] as AppRole[],
          },
        ]
      : []),
  ]

  const handleLogout = async () => {
    setMobileMenuOpen(false)
    await supabase.auth.signOut()
    navigate({ to: '/' })
  }

  const [currentTitle, currentSubtitle] = pageMeta[location.pathname] || [title, '']

  return (
    <>
      <header
        className="sticky top-0 z-40 flex items-center gap-[18px] h-[66px] px-5 md:px-7 border-b border-border"
        style={{
          background: 'color-mix(in srgb, var(--color-background) 82%, transparent)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>

        <div className="min-w-0">
          <h1 className="text-[18px] font-extrabold tracking-tight">{currentTitle}</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">{currentSubtitle}</p>
        </div>

        <div className="flex-1" />

        {/* Search bar */}
        <div className="relative hidden sm:block w-[260px] max-w-[32vw]">
          <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            ⌕
          </span>
          <input
            placeholder="بحث سريع…"
            className="w-full h-[38px] border border-border rounded-[10px] bg-muted ps-9 pe-14 font-sans text-[13px] text-foreground outline-none focus:border-primary focus:bg-card transition-colors"
          />
          <span className="absolute end-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground border border-border rounded-md px-1.5 py-0.5">
            ⌘K
          </span>
        </div>

        {/* Live indicator */}
        <div
          className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[12px] font-semibold"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}
        >
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{ background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.18)' }}
          />
          مباشر
        </div>

        <NotificationBell />
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
          {roles[0] && (
            <div className="px-3 py-1.5">
              <Badge className="text-[10px] text-white bg-primary border-transparent gap-1">
                <Shield className="h-3 w-3" />
                {getRoleLabel(roles[0])}
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
