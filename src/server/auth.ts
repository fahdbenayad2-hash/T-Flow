import { createServerFn } from '@tanstack/react-start'
import type { AppRole } from '~/lib/types'

const DEMO_MODE = !process.env.APP_SUPABASE_URL || process.env.APP_SUPABASE_URL === 'https://your-project-ref.supabase.co'

export const fetchUser = createServerFn({ method: 'GET' }).handler(async () => {
  if (DEMO_MODE) {
    return { id: 'demo-admin-id', email: 'fahdbenayad2@gmail.com' }
  }

  const { getSupabaseServerClient } = await import('~/utils/supabase-server')
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return null
  }

  return {
    id: data.user.id,
    email: data.user.email || '',
  }
})

export const fetchUserRoles = createServerFn({ method: 'GET' })
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    if (DEMO_MODE) {
      return ['admin'] as AppRole[]
    }

    const { getSupabaseServerClient } = await import('~/utils/supabase-server')
    const supabase = getSupabaseServerClient()

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to fetch roles:', error)
      return []
    }

    return (data || []).map((r) => r.role) as AppRole[]
  })

export const signIn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    if (DEMO_MODE) {
      return {
        user: { id: 'demo-admin-id', email: data.email },
        session: { access_token: 'demo-token' },
      }
    }

    const { getSupabaseServerClient } = await import('~/utils/supabase-server')
    const supabase = getSupabaseServerClient()

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      throw new Error(error.message)
    }

    return {
      user: {
        id: authData.user.id,
        email: authData.user.email || '',
      },
      session: authData.session,
    }
  })
