import { useMemo } from 'react'
import type { AppRole } from '~/lib/types'

interface UserContext {
  user: { id: string; email: string } | null
  roles: AppRole[]
}

export function useRole() {
  const user = null as { id: string; email: string } | null
  const roles = [] as AppRole[]

  return useMemo(() => {
    const hasRole = (role: AppRole) => roles.includes(role)
    const isAdmin = hasRole('admin')
    const isAgent = hasRole('confirmation_agent')
    const isShipping = hasRole('shipping_manager')

    return {
      user,
      roles,
      hasRole,
      isAdmin,
      isAgent,
      isShipping,
      isLoading: false,
    }
  }, [user, roles])
}
