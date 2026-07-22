const PLACEHOLDER_PATTERNS = [
  'your-project-ref.supabase.co',
  'your-anon-key',
  'your-service-role-key',
  'YOUR_SCRIPT_ID',
]

const REQUIRED_SERVER_VARS = [
  'APP_SUPABASE_URL',
  'APP_SUPABASE_SERVICE_ROLE_KEY',
  'APPS_SCRIPT_URL',
] as const

const REQUIRED_CLIENT_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => value.includes(p))
}

export function validateEnv() {
  const errors: string[] = []
  const isProd = process.env.NODE_ENV === 'production'

  for (const key of REQUIRED_SERVER_VARS) {
    const val = process.env[key]
    if (!val) {
      errors.push(`Missing required env var: ${key}`)
    } else if (isPlaceholder(val)) {
      errors.push(`${key} contains a placeholder value: ${val}`)
    }
  }

  for (const key of REQUIRED_CLIENT_VARS) {
    const val = process.env[key]
    if (!val) {
      errors.push(`Missing required env var: ${key}`)
    } else if (isPlaceholder(val)) {
      errors.push(`${key} contains a placeholder value: ${val}`)
    }
  }

  if (errors.length > 0) {
    if (isProd) {
      throw new Error(
        `[T-Flow] Environment validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}\n\n` +
        'The app cannot start in production with missing or placeholder env vars.\n' +
        'Copy .env.example to .env and fill in your real values.'
      )
    } else {
      console.warn(
        `[T-Flow] Environment warnings (dev mode — falling back to demo):\n${errors.map((e) => `  - ${e}`).join('\n')}`
      )
    }
  }
}

let _validated = false

export function ensureEnvChecked() {
  if (_validated) return
  _validated = true
  validateEnv()
}
