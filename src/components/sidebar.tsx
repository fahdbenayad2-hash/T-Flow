import { Link, useLocation } from '@tanstack/react-router'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Phone,
  Settings,
  Package,
  DollarSign,
  Truck,
  BarChart3,
} from 'lucide-react'
import { cn } from '~/lib/utils'
import { useRole, getRoleLabel } from '~/hooks/useRole'
import type { AppRole } from '~/lib/types'

export interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  group: 'ops' | 'analytics' | 'system'
  roles?: AppRole[]
}

export const navItems: NavItem[] = [
  { to: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, group: 'ops' },
  { to: '/orders', label: 'الطلبات', icon: ShoppingCart, group: 'ops' },
  { to: '/customers', label: 'العملاء', icon: Users, group: 'ops' },
  { to: '/call-center', label: 'مركز المكالمات', icon: Phone, group: 'ops' },
  { to: '/products', label: 'المنتجات', icon: Package, group: 'analytics', roles: ['admin'] },
  { to: '/earnings', label: 'الإيرادات', icon: DollarSign, group: 'analytics', roles: ['admin'] },
  {
    to: '/delivery',
    label: 'التوصيل',
    icon: Truck,
    group: 'analytics',
    roles: ['admin', 'shipping_manager'],
  },
  { to: '/reports', label: 'التقارير', icon: BarChart3, group: 'analytics', roles: ['admin'] },
  { to: '/settings', label: 'الإعدادات', icon: Settings, group: 'system', roles: ['admin'] },
]

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string
  items: NavItem[]
  pathname: string
}) {
  if (items.length === 0) return null
  return (
    <div className="mb-4">
      <div
        className="px-3 pb-2 font-mono text-[9.5px] font-medium tracking-[0.16em] uppercase"
        style={{ color: 'rgba(242,242,243,0.32)' }}
      >
        {label}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'relative flex items-center gap-2.5 rounded-[10px] px-3 py-[9px] text-[13.5px] font-medium transition-all duration-150',
                isActive
                  ? 'bg-sidebar-accent text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white',
              )}
            >
              <span
                className="h-[6px] w-[6px] shrink-0 rounded-full transition-all duration-200"
                style={{
                  background: isActive ? '#e31e24' : 'rgba(242,242,243,0.28)',
                  boxShadow: isActive ? '0 0 8px rgba(227,30,36,0.7)' : 'none',
                }}
              />
              <span className="flex-1">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function Sidebar() {
  const location = useLocation()
  const { roles, isAdmin } = useRole()

  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles) return true
    return item.roles.some((r) => roles.includes(r))
  })

  const opsItems = visibleNavItems.filter((i) => i.group === 'ops')
  const analyticsItems = visibleNavItems.filter((i) => i.group === 'analytics')
  const systemItems = visibleNavItems.filter((i) => i.group === 'system' || i.to === '/users')

  const primaryRole = roles[0]
  const userInitials = 'م'
  const userName = primaryRole ? getRoleLabel(primaryRole) : 'مستخدم'

  return (
    <aside className="hidden md:flex md:w-[264px] md:flex-col md:fixed md:inset-y-0 md:overflow-hidden bg-sidebar-background text-sidebar-foreground border-l border-sidebar-border">
      {/* Brand header with diagonal stripes */}
      <div className="relative flex h-[66px] items-center gap-2.5 px-5 border-b border-white/[0.07] overflow-hidden">
        <div
          className="absolute inset-0 opacity-50 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-18deg, rgba(227,30,36,0.32) 0px, rgba(227,30,36,0.32) 2px, transparent 2px, transparent 30px)',
            WebkitMaskImage: 'linear-gradient(to left, black, transparent 72%)',
            maskImage: 'linear-gradient(to left, black, transparent 72%)',
          }}
        />
        <img
          src="/logo.png"
          alt="T-Flow"
          className="relative h-[30px] w-[30px] object-contain shrink-0"
        />
        <div className="relative leading-none">
          <div className="text-[19px] font-black tracking-tight">
            <span className="text-primary">T</span>-Flow
          </div>
          <div
            className="font-mono text-[8.5px] tracking-[0.18em] mt-[3px]"
            style={{ color: 'rgba(242,242,243,0.4)' }}
          >
            FAST · SMART · DELIVERED
          </div>
        </div>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavGroup label="العمليات" items={opsItems} pathname={location.pathname} />
        {analyticsItems.length > 0 && (
          <NavGroup label="التحليلات" items={analyticsItems} pathname={location.pathname} />
        )}
        {isAdmin && (
          <NavGroup
            label="النظام"
            items={[
              ...systemItems.filter((i) => i.to === '/users'),
              ...systemItems.filter(
                (i) => i.to === '/users' && !systemItems.find((s) => s.to === i.to),
              ),
            ].filter((item, i, arr) => arr.findIndex((a) => a.to === item.to) === i)}
            pathname={location.pathname}
          />
        )}
      </nav>

      {/* User section at bottom */}
      <div className="p-3 border-t border-white/[0.07]">
        <div className="flex items-center gap-2.5 rounded-[11px] bg-white/[0.04] p-2.5">
          <div
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #e31e24, #7d1622)' }}
          >
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold truncate">{userName}</div>
            <div
              className="flex items-center gap-1.5 text-[10px] mt-0.5"
              style={{ color: '#ff8286' }}
            >
              <span className="h-[5px] w-[5px] rounded-full bg-primary" />
              {primaryRole ? getRoleLabel(primaryRole) : 'مستخدم'}
            </div>
          </div>
          <span className="text-white/40 text-base">⌄</span>
        </div>
      </div>
    </aside>
  )
}
