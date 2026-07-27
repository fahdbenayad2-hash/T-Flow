import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ensureEnvChecked } from '~/server/env-check'

ensureEnvChecked()

const url = () => process.env.APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL!
const anonKey = () => process.env.VITE_SUPABASE_ANON_KEY!

/**
 * Service-role client — for admin operations only (user management, audit log reads).
 * NEVER use in user-scoped code paths.
 * Creates a fresh instance per call to avoid cross-request leakage in SSR.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const key = process.env.APP_SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Missing APP_SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Anon-key client — for public operations (signIn, signUp).
 * Does NOT bypass RLS.
 */
export function getSupabaseAnonClient(): SupabaseClient {
  return createClient(url(), anonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Session-aware client — for user-scoped server operations.
 * Uses the user's JWT from the request cookie, so RLS applies.
 */
export function getSupabaseSessionClient(accessToken: string): SupabaseClient {
  return createClient(url(), anonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  })
}
