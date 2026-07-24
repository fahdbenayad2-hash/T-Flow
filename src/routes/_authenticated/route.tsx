import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import { Sidebar } from '~/components/sidebar'
import { BottomNav } from '~/components/bottom-nav'
import { Header } from '~/components/header'
import { ErrorBoundary } from '~/components/error-boundary'
import { supabase } from '~/utils/supabase-client'
import { PageTransition } from '~/components/page-transition'
import { RoleProvider } from '~/hooks/useRole'
import { navItems } from '~/components/sidebar'

const allNavRoutes = [
  ...navItems,
  { to: '/users', label: 'إدارة المستخدمين' },
].sort((a, b) => b.to.length - a.to.length)

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    if (typeof window === 'undefined') return { user: null }

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      throw redirect({ to: '/auth' })
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email || '',
      },
    }
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
