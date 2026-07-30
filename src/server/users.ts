import { createServerFn } from '@tanstack/react-start'
import { DEMO_MODE_SERVER as DEMO_MODE } from '~/config'
import { getSupabaseAdminClient } from '~/utils/supabase-server'
import { requireAdmin } from './auth'
import { resolveDefaultStoreId } from './order-repository'
import type { AppRole } from '~/lib/types'

async function requireStoreAdmin() {
  const callerId = await requireAdmin()
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(callerId, supabase)
  const { data: membership, error } = await supabase
    .from('store_members')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', callerId)
    .eq('role', 'admin')
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  if (!membership) throw new Error('FORBIDDEN')
  return { callerId, storeId, supabase }
}

async function targetIsStoreMember(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  storeId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('store_members')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)

  if (error) throw error
  return Boolean(data?.length)
}

async function syncGlobalRoles(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
) {
  const { data: memberships, error: membershipError } = await supabase
    .from('store_members')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (membershipError) throw membershipError

  const roles = [...new Set((memberships || []).map((membership) => membership.role as AppRole))]
  const { error: clearError } = await supabase.from('user_roles').delete().eq('user_id', userId)
  if (clearError) throw clearError

  if (roles.length) {
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert(roles.map((role) => ({ user_id: userId, role })))
    if (insertError) throw insertError
  }
}

export const listUsers = createServerFn({ method: 'GET' }).handler(async () => {
  if (DEMO_MODE) {
    return [
      {
        id: 'demo-admin-id',
        email: 'demo@tflow.app',
        full_name: 'المدير',
        roles: ['admin'] as AppRole[],
        created_at: new Date().toISOString(),
      },
    ]
  }

  const { storeId, supabase } = await requireStoreAdmin()
  const { data: memberships, error: membershipError } = await supabase
    .from('store_members')
    .select('user_id,role,joined_at')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('joined_at', { ascending: true })

  if (membershipError) throw membershipError

  const rolesByUser = new Map<string, AppRole[]>()
  const joinedAtByUser = new Map<string, string>()
  for (const membership of memberships || []) {
    const roles = rolesByUser.get(membership.user_id) || []
    roles.push(membership.role as AppRole)
    rolesByUser.set(membership.user_id, roles)
    if (!joinedAtByUser.has(membership.user_id)) {
      joinedAtByUser.set(membership.user_id, membership.joined_at)
    }
  }

  const users = await Promise.all(
    [...rolesByUser.keys()].map(async (userId) => {
      const { data, error } = await supabase.auth.admin.getUserById(userId)
      if (error || !data.user) return null
      return {
        id: data.user.id,
        email: data.user.email || '',
        full_name: data.user.user_metadata?.full_name || null,
        roles: rolesByUser.get(userId) || [],
        created_at: data.user.created_at || joinedAtByUser.get(userId) || new Date().toISOString(),
      }
    }),
  )

  return users.filter((user): user is NonNullable<typeof user> => Boolean(user))
})

export const createUser = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string; fullName?: string; role: AppRole }) => data)
  .handler(async ({ data }) => {
    if (DEMO_MODE) {
      return { ok: true as const, data: { success: true, userId: 'demo-new-user' } }
    }

    const { storeId, supabase } = await requireStoreAdmin()
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName?.trim() || '',
        registration_type: 'invited_member',
      },
    })

    if (authError) {
      return {
        ok: false as const,
        error: { code: 'CREATE_USER_FAILED', message: `فشل إنشاء المستخدم: ${authError.message}` },
      }
    }

    const userId = authData.user.id
    const [{ error: roleError }, { error: membershipError }] = await Promise.all([
      supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: data.role }, { onConflict: 'user_id,role' }),
      supabase.from('store_members').upsert(
        {
          store_id: storeId,
          user_id: userId,
          role: data.role,
          is_active: true,
        },
        { onConflict: 'store_id,user_id,role' },
      ),
    ])

    if (roleError || membershipError) {
      await supabase.auth.admin.deleteUser(userId)
      return {
        ok: false as const,
        error: {
          code: 'ASSIGN_ROLE_FAILED',
          message: `تعذر إضافة المستخدم إلى المتجر: ${
            membershipError?.message || roleError?.message || 'خطأ غير معروف'
          }`,
        },
      }
    }

    return { ok: true as const, data: { success: true, userId } }
  })

export const addUserRole = createServerFn({ method: 'POST' })
  .validator((data: { userId: string; role: AppRole }) => data)
  .handler(async ({ data }) => {
    if (DEMO_MODE) return { ok: true as const, data: { success: true } }

    const { storeId, supabase } = await requireStoreAdmin()
    if (!(await targetIsStoreMember(supabase, storeId, data.userId))) {
      return {
        ok: false as const,
        error: { code: 'NOT_STORE_MEMBER', message: 'هذا المستخدم لا ينتمي إلى متجرك' },
      }
    }

    const [{ error: roleError }, { error: membershipError }] = await Promise.all([
      supabase
        .from('user_roles')
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: 'user_id,role' }),
      supabase.from('store_members').upsert(
        {
          store_id: storeId,
          user_id: data.userId,
          role: data.role,
          is_active: true,
        },
        { onConflict: 'store_id,user_id,role' },
      ),
    ])

    if (roleError || membershipError) {
      return {
        ok: false as const,
        error: {
          code: 'ADD_ROLE_FAILED',
          message: `فشل إضافة الصلاحية: ${membershipError?.message || roleError?.message}`,
        },
      }
    }
    return { ok: true as const, data: { success: true } }
  })

export const removeUserRole = createServerFn({ method: 'POST' })
  .validator((data: { userId: string; role: AppRole }) => data)
  .handler(async ({ data }) => {
    if (DEMO_MODE) return { ok: true as const, data: { success: true } }

    const { storeId, supabase } = await requireStoreAdmin()
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('owner_id')
      .eq('id', storeId)
      .single()

    if (storeError) throw storeError
    if (store.owner_id === data.userId && data.role === 'admin') {
      return {
        ok: false as const,
        error: { code: 'OWNER_ROLE_REQUIRED', message: 'لا يمكن إزالة دور المدير من مالك المتجر' },
      }
    }

    if (!(await targetIsStoreMember(supabase, storeId, data.userId))) {
      return {
        ok: false as const,
        error: { code: 'NOT_STORE_MEMBER', message: 'هذا المستخدم لا ينتمي إلى متجرك' },
      }
    }

    const { error } = await supabase
      .from('store_members')
      .delete()
      .eq('store_id', storeId)
      .eq('user_id', data.userId)
      .eq('role', data.role)

    if (error) {
      return {
        ok: false as const,
        error: { code: 'REMOVE_ROLE_FAILED', message: `فشل حذف الصلاحية: ${error.message}` },
      }
    }

    await syncGlobalRoles(supabase, data.userId)
    return { ok: true as const, data: { success: true } }
  })

export const deleteUser = createServerFn({ method: 'POST' })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    if (DEMO_MODE) return { ok: true as const, data: { success: true } }

    const { callerId, storeId, supabase } = await requireStoreAdmin()
    if (callerId === data.userId) {
      return {
        ok: false as const,
        error: { code: 'CANNOT_DELETE_SELF', message: 'لا يمكنك حذف حسابك من هنا' },
      }
    }

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('owner_id')
      .eq('id', storeId)
      .single()

    if (storeError) throw storeError
    if (store.owner_id === data.userId) {
      return {
        ok: false as const,
        error: { code: 'CANNOT_DELETE_OWNER', message: 'لا يمكن حذف مالك المتجر' },
      }
    }

    if (!(await targetIsStoreMember(supabase, storeId, data.userId))) {
      return {
        ok: false as const,
        error: { code: 'NOT_STORE_MEMBER', message: 'هذا المستخدم لا ينتمي إلى متجرك' },
      }
    }

    const { data: allMemberships, error: membershipsError } = await supabase
      .from('store_members')
      .select('store_id')
      .eq('user_id', data.userId)
      .eq('is_active', true)

    if (membershipsError) throw membershipsError

    if ((allMemberships || []).some((membership) => membership.store_id !== storeId)) {
      const { error } = await supabase
        .from('store_members')
        .delete()
        .eq('store_id', storeId)
        .eq('user_id', data.userId)
      if (error) throw error
      await syncGlobalRoles(supabase, data.userId)
    } else {
      const { error } = await supabase.auth.admin.deleteUser(data.userId)
      if (error) {
        return {
          ok: false as const,
          error: { code: 'DELETE_USER_FAILED', message: `فشل حذف المستخدم: ${error.message}` },
        }
      }
    }

    return { ok: true as const, data: { success: true } }
  })
