/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly APPS_SCRIPT_URL: string
  readonly DEFAULT_ADMIN_EMAIL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
