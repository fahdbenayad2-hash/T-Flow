import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useRole } from '~/hooks/useRole'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Phone,
  Package,
  DollarSign,
  Truck,
  BarChart3,
  Settings,
  Shield,
  Search,
  X,
  Webhook,
  FileSpreadsheet,
} from 'lucide-react'
import { cn } from '~/lib/utils'
import type { AppRole } from '~/lib/types'

interface CommandItem {
  label: string
  icon: React.ReactNode
  to: string
  roles?: AppRole[]
}

const commands: CommandItem[] = [
  { label: 'لوحة التحكم', icon: <LayoutDashboard className="h-4 w-4" />, to: '/dashboard' },
  { label: 'الطلبات', icon: <ShoppingCart className="h-4 w-4" />, to: '/orders' },
  { label: 'العملاء', icon: <Users className="h-4 w-4" />, to: '/customers' },
  { label: 'مركز المكالمات', icon: <Phone className="h-4 w-4" />, to: '/call-center' },
  { label: 'المنتجات', icon: <Package className="h-4 w-4" />, to: '/products', roles: ['admin'] },
  {
    label: 'الإيرادات',
    icon: <DollarSign className="h-4 w-4" />,
    to: '/earnings',
    roles: ['admin'],
  },
  {
    label: 'التوصيل',
    icon: <Truck className="h-4 w-4" />,
    to: '/delivery',
    roles: ['admin', 'shipping_manager'],
  },
  { label: 'التقارير', icon: <BarChart3 className="h-4 w-4" />, to: '/reports', roles: ['admin'] },
  {
    label: 'ربط المتاجر',
    icon: <Webhook className="h-4 w-4" />,
    to: '/integrations',
    roles: ['admin'],
  },
  {
    label: 'ربط Google Sheets',
    icon: <FileSpreadsheet className="h-4 w-4" />,
    to: '/google-sheets',
    roles: ['admin'],
  },
  { label: 'الإعدادات', icon: <Settings className="h-4 w-4" />, to: '/settings', roles: ['admin'] },
  {
    label: 'إدارة المستخدمين',
    icon: <Shield className="h-4 w-4" />,
    to: '/users',
    roles: ['admin'],
  },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const navigate = useNavigate()
  const { roles } = useRole()
  const filtered = useMemo(() => {
    return commands.filter((cmd) => {
      if (cmd.roles && !cmd.roles.some((r) => roles.includes(r))) return false
      if (!query) return true
      return cmd.label.includes(query)
    })
  }, [query, roles])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const runCommand = useCallback(
    (cmd: CommandItem) => {
      setOpen(false)
      setQuery('')
      navigate({ to: cmd.to as '/' })
    },
    [navigate],
  )

  useEffect(() => {
    const openSearch = () => setOpen(true)
    window.addEventListener('tflow:open-quick-search', openSearch)
    return () => window.removeEventListener('tflow:open-quick-search', openSearch)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && filtered[activeIndex]) {
        runCommand(filtered[activeIndex])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, filtered, activeIndex, runCommand])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999]" dir="rtl">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          setOpen(false)
          setQuery('')
        }}
      />
      <div className="flex items-start justify-center pt-[20vh]">
        <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              placeholder="ابحث عن صفحة..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded border border-border">
              ESC
            </kbd>
            <button
              onClick={() => {
                setOpen(false)
                setQuery('')
              }}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                لا توجد نتائج
              </div>
            )}
            {filtered.map((cmd, i) => (
              <button
                key={cmd.to}
                onClick={() => runCommand(cmd)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  i === activeIndex
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <span className="shrink-0">{cmd.icon}</span>
                <span className="flex-1 text-right">{cmd.label}</span>
                <span className="text-xs text-muted-foreground font-mono opacity-50">{cmd.to}</span>
              </button>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-border flex items-center gap-2 text-[10px] text-muted-foreground">
            <kbd className="inline-flex items-center px-1 py-0.5 bg-muted rounded border border-border font-mono">
              ↑↓
            </kbd>
            <span>تنقل</span>
            <kbd className="inline-flex items-center px-1 py-0.5 bg-muted rounded border border-border font-mono">
              ↵
            </kbd>
            <span>فتح</span>
            <kbd className="inline-flex items-center px-1 py-0.5 bg-muted rounded border border-border font-mono">
              ESC
            </kbd>
            <span>إغلاق</span>
          </div>
        </div>
      </div>
    </div>
  )
}
