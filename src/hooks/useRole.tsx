import { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '~/utils/supabase-client'
import type { AppRole } from '~/lib/types'

interface RoleContextValue {
  roles: AppRole[]
  hasRole: (role: AppRole) => boolean
  isAdmin: boolean
  isAgent: boolean
  isShipping: boolean
  canManageUsers: boolean
  canViewFinancials: boolean
  canBulkEdit: boolean
  canAccessSettings: boolean
  isLoading: boolean
}

const RoleContext = createContext<RoleContextValue>({
  roles: [],
  hasRole: () => false,
  isAdmin: false,
  isAgent: false,
  isShipping: false,
  canManageUsers: false,
  canViewFinancials: false,
  canBulkEdit: false,
  canAccessSettings: false,
  isLoading: true,
})

export function useRole() {
  return useContext(RoleContext)
}

export function useRoleQuery(userId: string | null) {
  return useQuery({
    queryKey: ['user-roles', userId],
    queryFn: async (): Promise<AppRole[]> => {
      if (!userId) return []

      const DEMO_MODE = !import.meta.env.VITE_SUPABASE_URL ||
        import.meta.env.VITE_SUPABASE_URL === 'https://your-project-ref.supabase.co'

      if (DEMO_MODE) {
        return ['admin']
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)

      if (error) {
        console.error('Failed to fetch roles:', error)
        return []
      }

      return (data || []).map((r) => r.role as AppRole)
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  })
}

export function RoleProvider({
  userId,
  children,
}: {
  userId: string | null
  children: React.ReactNode
}) {
  const { data: roles = [], isLoading } = useRoleQuery(userId)

  const value = useMemo<RoleContextValue>(() => {
    const hasRole = (role: AppRole) => roles.includes(role)
    const isAdmin = hasRole('admin')
    const isAgent = hasRole('confirmation_agent')
    const isShipping = hasRole('shipping_manager')

    return {
      roles,
      hasRole,
      isAdmin,
      isAgent,
      isShipping,
      canManageUsers: isAdmin,
      canViewFinancials: isAdmin,
      canBulkEdit: isAdmin || isAgent,
      canAccessSettings: isAdmin,
      isLoading,
    }
  }, [roles, isLoading])

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  )
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'مدير',
  confirmation_agent: 'وكيل تأكيد',
  shipping_manager: 'مدير شحن',
}

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-[var(--status-delivered)]',
  confirmation_agent: 'bg-[var(--status-processing)]',
  shipping_manager: 'bg-[var(--status-shipped)]',
}

export function getRoleLabel(role: AppRole): string {
  return ROLE_LABELS[role] || role
}

export function getRoleColor(role: AppRole): string {
  return ROLE_COLORS[role] || 'bg-muted'
}
