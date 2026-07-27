import { createClient } from '@supabase/supabase-js'
import { setAuthCookie, clearAuthCookie } from './auth-cookie'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Keep the SSR auth cookie in sync with the Supabase session: without this the
// cookie goes stale after the access token's ~1h lifetime (users get bounced to
// /auth) and sign-out leaves a still-valid token behind in the cookie.
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      clearAuthCookie()
    } else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
      setAuthCookie(session.access_token, session.expires_in)
    }
  })
}
