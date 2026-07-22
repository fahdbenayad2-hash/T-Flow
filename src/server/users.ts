import { createServerFn } from '@tanstack/react-start'
import type { AppRole } from '~/lib/types'

const DEMO_MODE = !process.env.APP_SUPABASE_URL || process.env.APP_SUPABASE_URL === 'https://your-project-ref.supabase.co'

export const listUsers = createServerFn({ method: 'GET' }).handler(async () => {
  if (DEMO_MODE) {
    return [
      { id: 'demo-admin-id', email: 'fahdbenayad2@gmail.com', full_name: 'المدير', roles: ['admin'] as AppRole[], created_at: new Date().toISOString() },
    ]
  }

  const { getSupabaseServerClient } = await import('~/utils/supabase-server')
  const supabase = getSupabaseServerClient()

  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
  if (authError) {
    console.error('Failed to list auth users:', authError)
    return []
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('*')

  const rolesByUser = new Map<string, AppRole[]>()
  for (const r of roles || []) {
    const existing = rolesByUser.get(r.user_id) || []
    existing.push(r.role as AppRole)
    rolesByUser.set(r.user_id, existing)
  }

  return authUsers.users.map((u) => ({
    id: u.id,
    email: u.email || '',
    full_name: u.user_metadata?.full_name || null,
    roles: rolesByUser.get(u.id) || [],
    created_at: u.created_at,
  }))
})

export const createUser = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string; fullName?: string; role: AppRole }) => data)
  .handler(async ({ data }) => {
    if (DEMO_MODE) {
      return { ok: true as const, data: { success: true, userId: 'demo-new-user' } }
    }

    const { getSupabaseServerClient } = await import('~/utils/supabase-server')
    const supabase = getSupabaseServerClient()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName || '' },
    })

    if (authError) {
      return { ok: false as const, error: { code: 'CREATE_USER_FAILED', message: `فشل إنشاء المستخدم: ${authError.message}` } }
    }

    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: authData.user.id, role: data.role })

    if (roleError) {
      console.error('Failed to assign role:', roleError)
    }

    return { ok: true as const, data: { success: true, userId: authData.user.id } }
  })

export const addUserRole = createServerFn({ method: 'POST' })
  .validator((data: { userId: string; role: AppRole }) => data)
  .handler(async ({ data }) => {
    if (DEMO_MODE) return { ok: true as const, data: { success: true } }

    const { getSupabaseServerClient } = await import('~/utils/supabase-server')
    const supabase = getSupabaseServerClient()

    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: 'user_id,role' })

    if (error) {
      return { ok: false as const, error: { code: 'ADD_ROLE_FAILED', message: `فشل إضافة الصلاحية: ${error.message}` } }
    }
    return { ok: true as const, data: { success: true } }
  })

export const removeUserRole = createServerFn({ method: 'POST' })
  .validator((data: { userId: string; role: AppRole }) => data)
  .handler(async ({ data }) => {
    if (DEMO_MODE) return { ok: true as const, data: { success: true } }

    const { getSupabaseServerClient } = await import('~/utils/supabase-server')
    const supabase = getSupabaseServerClient()

    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', data.userId)
      .eq('role', data.role)

    if (error) {
      return { ok: false as const, error: { code: 'REMOVE_ROLE_FAILED', message: `فشل حذف الصلاحية: ${error.message}` } }
    }
    return { ok: true as const, data: { success: true } }
  })

export const deleteUser = createServerFn({ method: 'POST' })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    if (DEMO_MODE) return { ok: true as const, data: { success: true } }

    const { getSupabaseServerClient } = await import('~/utils/supabase-server')
    const supabase = getSupabaseServerClient()

    const { error } = await supabase.auth.admin.deleteUser(data.userId)
    if (error) {
      return { ok: false as const, error: { code: 'DELETE_USER_FAILED', message: `فشل حذف المستخدم: ${error.message}` } }
    }
    return { ok: true as const, data: { success: true } }
  })
