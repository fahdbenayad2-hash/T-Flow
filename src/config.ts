const isPlaceholder = (url: string | undefined) =>
  !url || url === 'https://your-project-ref.supabase.co'

/**
 * Single source of truth for DEMO_MODE.
 * Server-side: checks APP_SUPABASE_URL (never reaches the client bundle).
 * Client-side: checks VITE_SUPABASE_URL (bundled into client JS — only safe values here).
 */
export const DEMO_MODE_SERVER = isPlaceholder(process.env.APP_SUPABASE_URL)

export const DEMO_MODE_CLIENT = isPlaceholder(
  import.meta.env.VITE_SUPABASE_URL as string | undefined,
)

/** Cache TTL in seconds for order queries (server-side) */
export const ORDER_CACHE_TTL_S = 45

/** Cache GC time in milliseconds for React Query */
export const ORDER_GC_TIME_MS = 5 * 60 * 1000

/** Cookie name for storing the user's access token (for SSR auth checks) */
export const AUTH_TOKEN_COOKIE = 'tf-at'

/** Apps Script shared secret — sent as X-TFlow-Secret header */
export const APPS_SCRIPT_SECRET = process.env.APPS_SCRIPT_SECRET || ''

export type OrderStorageMode = 'sheets' | 'shadow' | 'supabase'

/**
 * Order storage rollout mode.
 *
 * - sheets: Google Sheets is the only order store (current production behavior)
 * - shadow: Sheets remains primary; successful mutations are mirrored to Supabase
 * - supabase: Supabase is primary; switch back to sheets for an immediate rollback
 */
export function getOrderStorageMode(value = process.env.ORDER_STORAGE_MODE): OrderStorageMode {
  if (value === 'shadow' || value === 'supabase') return value
  return 'sheets'
}
