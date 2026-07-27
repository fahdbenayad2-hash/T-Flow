import { AUTH_TOKEN_COOKIE } from '~/config'

/** Mirror the Supabase access token into a cookie so SSR route guards can validate it. */
export function setAuthCookie(accessToken: string, expiresIn: number) {
  const maxAge = Math.max(expiresIn, 60 * 60 * 24 * 7)
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${AUTH_TOKEN_COOKIE}=${accessToken}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`
}

export function clearAuthCookie() {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${AUTH_TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax${secure}`
}
