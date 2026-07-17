import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '~/utils/supabase-client'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        throw redirect({ to: '/dashboard' })
      } else {
        throw redirect({ to: '/auth' })
      }
    }
    throw redirect({ to: '/auth' })
  },
  component: () => null,
})
