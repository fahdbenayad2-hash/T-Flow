import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import { Sidebar } from '~/components/sidebar'
import { BottomNav } from '~/components/bottom-nav'
import { Header } from '~/components/header'
import { ErrorBoundary } from '~/components/error-boundary'
import { PageTransition } from '~/components/page-transition'
import { RoleProvider } from '~/hooks/useRole'
import { navItems } from '~/components/sidebar'
import { fetchUser } from '~/server/auth'
import { CommandPalette } from '~/components/command-palette'
import { GoogleSheetsAutoSync } from '~/components/google-sheets-auto-sync'
import { TenantScopeProvider } from '~/hooks/useTenantScope'

const allNavRoutes = [
  ...navItems,
  { to: '/users', label: 'إدارة المستخدمين' },
  { to: '/google-sheets', label: 'ربط Google Sheets' },
  { to: '/onboarding', label: 'تجهيز المتجر' },
].sort((a, b) => b.to.length - a.to.length)

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const user = await fetchUser()
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
    <TenantScopeProvider userId={user.id}>
      <RoleProvider userId={user.id}>
        <div className="min-h-screen bg-background">
          <ErrorBoundary>
            <Sidebar />
            <div className="md:pr-[264px]">
              <Header title={title} />
              <main className="p-5 md:p-7 pb-20 md:pb-10 max-w-[1360px] w-full">
                <ErrorBoundary>
                  <PageTransition>
                    <Outlet />
                  </PageTransition>
                </ErrorBoundary>
              </main>
            </div>
            <BottomNav />
            <CommandPalette />
            <GoogleSheetsAutoSync />
          </ErrorBoundary>
        </div>
      </RoleProvider>
    </TenantScopeProvider>
  )
}
