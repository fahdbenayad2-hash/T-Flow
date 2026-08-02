export const YALIDINE_BASE_URL = 'https://api.yalidine.app/v1'

export interface YalidineCredentials {
  apiId: string
  apiToken: string
  baseUrl?: string
}

export class YalidineApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'YalidineApiError'
  }
}

function safeBaseUrl(value = YALIDINE_BASE_URL) {
  const parsed = new URL(value)
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.yalidine.app') {
    throw new Error('رابط Yalidine API غير مسموح')
  }
  return parsed.toString().replace(/\/$/, '')
}

async function errorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: string; error?: string }
    return body.message || body.error || `Yalidine API: ${response.status}`
  } catch {
    return `Yalidine API: ${response.status}`
  }
}

export async function testYalidineCredentials(
  credentials: YalidineCredentials,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(`${safeBaseUrl(credentials.baseUrl)}/parcels?page_size=1`, {
    method: 'GET',
    headers: {
      'X-API-ID': credentials.apiId,
      'X-API-TOKEN': credentials.apiToken,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) throw new YalidineApiError(await errorMessage(response), response.status)
  return { connected: true as const }
}
