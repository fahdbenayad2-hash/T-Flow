import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import { Sidebar } from '~/components/sidebar'
import { BottomNav } from '~/components/bottom-nav'
import { Header } from '~/components/header'
import { ErrorBoundary } from '~/components/error-boundary'
import { PageTransition } from '~/components/page-transition'
import { RoleProvider } from '~/hooks/useRole'
import { navItems } from '~/components/sidebar'
import { AUTH_TOKEN_COOKIE } from '~/config'

const allNavRoutes = [...navItems, { to: '/users', label: 'إدارة المستخدمين' }].sort(
  (a, b) => b.to.length - a.to.length,
)

async function validateSession(): Promise<{ id: string; email: string } | null> {
  if (typeof window !== 'undefined') {
    const { supabase } = await import('~/utils/supabase-client')
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return null
    return { id: session.user.id, email: session.user.email || '' }
  }

  // SSR: try to validate via the auth token cookie
  try {
    const { getCookie } = await import('@tanstack/react-start/server')
    const token = getCookie(AUTH_TOKEN_COOKIE)
    if (!token) return null

    const { getSupabaseSessionClient } = await import('~/utils/supabase-server')
    const supabase = getSupabaseSessionClient(token)
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null
    return { id: data.user.id, email: data.user.email || '' }
  } catch {
    return null
  }
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const user = await validateSession()
    if (!user) {
      throw redirect({ to: '/auth' })
    }
    return { user }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { user } = Route.useRouteContext()
  const title = allNavRoutes.find((item) => pathname.startsWith(item.to))?.label || 'لوحة التحكم'

  return (
    <RoleProvider userId={user?.id || null}>
      <div className="min-h-screen bg-background">
        <ErrorBoundary>
          <Sidebar />
          <div className="md:pr-64">
            <Header title={title} />
            <main className="p-4 md:p-6 pb-20 md:pb-6">
              <ErrorBoundary>
                <PageTransition>
                  <Outlet />
                </PageTransition>
              </ErrorBoundary>
            </main>
          </div>
          <BottomNav />
        </ErrorBoundary>
      </div>
    </RoleProvider>
  )
}
