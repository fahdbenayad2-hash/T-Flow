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
