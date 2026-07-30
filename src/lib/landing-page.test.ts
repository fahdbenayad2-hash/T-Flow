import { describe, expect, it } from 'vitest'
import {
  isStorefrontOriginAllowed,
  normalizeStorefrontOrigin,
  readLandingPageConfig,
} from './landing-page'

describe('landing page integration helpers', () => {
  it('normalizes a full storefront URL to its origin', () => {
    expect(normalizeStorefrontOrigin('https://shop.example.com/order?product=1')).toBe(
      'https://shop.example.com',
    )
  })

  it('rejects unsupported protocols', () => {
    expect(() => normalizeStorefrontOrigin('file:///tmp/order.html')).toThrow(
      'رابط الموقع يجب أن يبدأ',
    )
  })

  it('reads safe defaults from integration config', () => {
    expect(readLandingPageConfig(null)).toEqual({ enabled: false, allowedOrigin: '' })
    expect(
      readLandingPageConfig({
        landingPage: { enabled: true, allowedOrigin: 'https://shop.example.com' },
      }),
    ).toEqual({ enabled: true, allowedOrigin: 'https://shop.example.com' })
  })

  it('matches only the configured browser origin', () => {
    expect(
      isStorefrontOriginAllowed('https://shop.example.com', 'https://shop.example.com/order'),
    ).toBe(true)
    expect(isStorefrontOriginAllowed('https://evil.example.com', 'https://shop.example.com')).toBe(
      false,
    )
  })
})
