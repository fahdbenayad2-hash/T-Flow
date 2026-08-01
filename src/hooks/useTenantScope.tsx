import { createContext, useContext } from 'react'

const TenantScopeContext = createContext<string | null>(null)

export function TenantScopeProvider({
  userId,
  children,
}: {
  userId: string
  children: React.ReactNode
}) {
  return <TenantScopeContext.Provider value={userId}>{children}</TenantScopeContext.Provider>
}

/** Returns the authenticated identity used to isolate all client-side query caches. */
// eslint-disable-next-line react-refresh/only-export-components
export function useTenantId(): string {
  const userId = useContext(TenantScopeContext)
  if (!userId) throw new Error('TENANT_SCOPE_REQUIRED')
  return userId
}
