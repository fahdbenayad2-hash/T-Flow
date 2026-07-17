import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { Sidebar } from '~/components/sidebar'
import { BottomNav } from '~/components/bottom-nav'
import { Header } from '~/components/header'
import { useState } from 'react'
import { supabase } from '~/utils/supabase-client'
import { PageTransition } from '~/components/page-transition'

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
  const [title, setTitle] = useState('لوحة التحكم')

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="md:pr-64">
        <Header title={title} />
        <main className="p-4 md:p-6 pb-20 md:pb-6">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
