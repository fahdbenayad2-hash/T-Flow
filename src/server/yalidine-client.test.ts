import { describe, expect, it, vi } from 'vitest'
import { testYalidineCredentials, YalidineApiError } from './yalidine-client'

describe('Yalidine client', () => {
  it('tests credentials without exposing them in the URL', async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = []
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init])
      return new Response('{}', { status: 200 })
    }

    await expect(
      testYalidineCredentials({ apiId: 'api-id', apiToken: 'api-token' }, fetcher as typeof fetch),
    ).resolves.toEqual({ connected: true })

    expect(calls).toHaveLength(1)
    const [url, init] = calls[0]
    expect(String(url)).toBe('https://api.yalidine.app/v1/parcels?page_size=1')
    expect(String(url)).not.toContain('api-token')
    expect(init?.headers).toMatchObject({
      'X-API-ID': 'api-id',
      'X-API-TOKEN': 'api-token',
    })
  })

  it('returns a typed API error for invalid credentials', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    await expect(
      testYalidineCredentials({ apiId: 'bad', apiToken: 'bad' }, fetcher),
    ).rejects.toEqual(expect.objectContaining<Partial<YalidineApiError>>({ status: 401 }))
  })

  it('blocks untrusted API hosts', async () => {
    await expect(
      testYalidineCredentials({
        apiId: 'api-id',
        apiToken: 'api-token',
        baseUrl: 'https://example.com/v1',
      }),
    ).rejects.toThrow('غير مسموح')
  })
})
