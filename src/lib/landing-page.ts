export interface LandingPageConfig {
  enabled: boolean
  allowedOrigin: string
}

export function normalizeStorefrontOrigin(value: string): string {
  const input = value.trim()
  if (!input) throw new Error('رابط الموقع مطلوب')

  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error('أدخل رابطًا صحيحًا مثل https://store.com')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('رابط الموقع يجب أن يبدأ بـ https:// أو http://')
  }

  return url.origin
}

export function readLandingPageConfig(config: unknown): LandingPageConfig {
  const record =
    config && typeof config === 'object' && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {}
  const landingPage =
    record.landingPage &&
    typeof record.landingPage === 'object' &&
    !Array.isArray(record.landingPage)
      ? (record.landingPage as Record<string, unknown>)
      : {}

  return {
    enabled: landingPage.enabled === true,
    allowedOrigin: typeof landingPage.allowedOrigin === 'string' ? landingPage.allowedOrigin : '',
  }
}

export function isStorefrontOriginAllowed(requestOrigin: string | null, allowedOrigin: string) {
  if (!requestOrigin || !allowedOrigin) return false
  try {
    return normalizeStorefrontOrigin(requestOrigin) === normalizeStorefrontOrigin(allowedOrigin)
  } catch {
    return false
  }
}
