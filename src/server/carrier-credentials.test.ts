import { describe, expect, it } from 'vitest'
import { decryptCarrierCredential, encryptCarrierCredential } from './carrier-credentials'

describe('carrier credential encryption', () => {
  it('encrypts and decrypts a carrier token', async () => {
    const encrypted = await encryptCarrierCredential('secret-token', 'test-key')

    expect(encrypted).toMatch(/^v1:/)
    expect(encrypted).not.toContain('secret-token')
    await expect(decryptCarrierCredential(encrypted, 'test-key')).resolves.toBe('secret-token')
  })

  it('rejects decryption with a different key', async () => {
    const encrypted = await encryptCarrierCredential('secret-token', 'first-key')

    await expect(decryptCarrierCredential(encrypted, 'second-key')).rejects.toThrow()
  })
})
