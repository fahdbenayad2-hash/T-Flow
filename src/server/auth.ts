import { createServerFn } from '@tanstack/react-start'
import {
  getSupabaseAdminClient,
  getSupabaseAnonClient,
  getSupabaseSessionClient,
} from '~/utils/supabase-server'
import { DEMO_MODE_SERVER as DEMO_MODE, AUTH_TOKEN_COOKIE } from '~/config'
import { getCookie } from '@tanstack/react-start/server'
import type { AppRole } from '~/lib/types'

export const fetchUser = createServerFn({ method: 'GET' }).handler(async () => {
  if (DEMO_MODE) {
    return { id: 'demo-admin-id', email: 'fahdbenayad2@gmail.com' }
  }

  const token = getCookie(AUTH_TOKEN_COOKIE)
  if (!token) return null

  try {
    const supabase = getSupabaseSessionClient(token)
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null
    return { id: data.user.id, email: data.user.email || '' }
  } catch {
    return null
  }
})

export const fetchUserRoles = createServerFn({ method: 'GET' })
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    if (DEMO_MODE) return ['admin'] as AppRole[]

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId)

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

    const supabase = getSupabaseAnonClient()
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

/** Require the current user to have admin role. Throws redirect to /auth if not. */
export async function requireAdmin() {
  if (DEMO_MODE) return 'demo-admin-id'

  const token = getCookie(AUTH_TOKEN_COOKIE)
  if (!token) throw new Error('UNAUTHORIZED')

  const supabase = getSupabaseSessionClient(token)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('UNAUTHORIZED')

  const admin = getSupabaseAdminClient()
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', data.user.id)

  const userRoles = (roles || []).map((r) => r.role) as AppRole[]
  if (!userRoles.includes('admin')) throw new Error('FORBIDDEN')

  return data.user.id
}
