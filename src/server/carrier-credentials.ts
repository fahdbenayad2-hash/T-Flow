function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function utf8(value: string) {
  return new TextEncoder().encode(value)
}

function encryptionMaterial(override?: string) {
  const material =
    override ||
    process.env.DELIVERY_CREDENTIALS_ENCRYPTION_KEY ||
    process.env.APP_SUPABASE_SERVICE_ROLE_KEY
  if (!material) throw new Error('مفتاح تشفير بيانات شركات التوصيل غير مهيأ')
  return `tflow-delivery-credentials:${material}`
}

async function credentialsEncryptionKey(override?: string) {
  const digest = await crypto.subtle.digest('SHA-256', utf8(encryptionMaterial(override)))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptCarrierCredential(value: string, keyMaterial?: string) {
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await credentialsEncryptionKey(keyMaterial),
      utf8(value),
    ),
  )
  return `v1:${toBase64Url(iv)}:${toBase64Url(ciphertext)}`
}

export async function decryptCarrierCredential(value: string, keyMaterial?: string) {
  const [version, ivText, ciphertextText] = value.split(':')
  if (version !== 'v1' || !ivText || !ciphertextText) {
    throw new Error('صيغة بيانات شركة التوصيل المشفرة غير صالحة')
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(ivText) },
    await credentialsEncryptionKey(keyMaterial),
    fromBase64Url(ciphertextText),
  )
  return new TextDecoder().decode(plaintext)
}
