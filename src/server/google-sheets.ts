import { createServerFn } from '@tanstack/react-start'
import {
  mapGoogleSheetRow,
  validateGoogleSheetMapping,
  type GoogleSheetColumnMapping,
} from '~/lib/google-sheet-mapping'
import {
  formatAlgiersDate,
  parseOrderDate,
  parseOrderPrice,
  parseOrderQuantity,
} from '~/lib/order-record'
import { ALL_STATUSES, STATUS } from '~/lib/sheet-mapping'
import { generateOrderId } from '~/lib/utils'
import { getSupabaseAdminClient } from '~/utils/supabase-server'
import { requireAdmin } from './auth'
import { resolveDefaultStoreId } from './order-repository'

const GOOGLE_PROVIDER = 'google_sheets_oauth'
const OAUTH_STATE_COOKIE = 'tf-google-oauth'
const MAX_IMPORT_ROWS = 5_000
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
]

interface GoogleAccountRow {
  id: string
  store_id: string
  google_user_id: string
  email: string
  access_token_encrypted: string
  refresh_token_encrypted: string | null
  token_expires_at: string | null
  scopes: string[] | null
  is_active: boolean
  created_at: string
}

interface GoogleSheetConfig {
  googleAccountId: string
  accountEmail: string
  spreadsheetId: string
  spreadsheetName: string
  sheetId: number
  sheetTitle: string
  storeName: string
  startRow: number
  mergeVariantProduct: boolean
  columnMapping: GoogleSheetColumnMapping
  version: number
}

interface GoogleSheetIntegrationRow {
  id: string
  external_account_id: string
  config: GoogleSheetConfig
  is_active: boolean
  last_synced_at: string | null
  created_at: string
}

interface OAuthState {
  userId: string
  storeId: string
  nonce: string
  expiresAt: number
}

function oauthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

function appOrigin() {
  const configured = process.env.PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (configured) return configured
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  if (vercelHost) return `https://${vercelHost}`
  return 'http://localhost:3000'
}

export function googleOAuthRedirectUri() {
  return `${appOrigin()}/api/integrations/google/callback`
}

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

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(value)))
}

function encryptionMaterial() {
  const material =
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ||
    process.env.APP_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.GOOGLE_CLIENT_SECRET
  if (!material) throw new Error('مفتاح تشفير Google غير مهيأ')
  return material
}

async function tokenEncryptionKey() {
  return crypto.subtle.importKey(
    'raw',
    await sha256(encryptionMaterial()),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptToken(value: string) {
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await tokenEncryptionKey(), utf8(value)),
  )
  return `v1:${toBase64Url(iv)}:${toBase64Url(ciphertext)}`
}

async function decryptToken(value: string) {
  const [version, ivText, ciphertextText] = value.split(':')
  if (version !== 'v1' || !ivText || !ciphertextText) {
    throw new Error('صيغة رمز Google غير صالحة')
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(ivText) },
    await tokenEncryptionKey(),
    fromBase64Url(ciphertextText),
  )
  return new TextDecoder().decode(plaintext)
}

function stateSecretMaterial() {
  const material =
    process.env.GOOGLE_OAUTH_STATE_SECRET ||
    process.env.APP_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.GOOGLE_CLIENT_SECRET
  if (!material) throw new Error('مفتاح حماية OAuth غير مهيأ')
  return `tflow-google-oauth:${material}`
}

async function stateSigningKey() {
  return crypto.subtle.importKey(
    'raw',
    await sha256(stateSecretMaterial()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function signState(payload: OAuthState) {
  const encoded = toBase64Url(utf8(JSON.stringify(payload)))
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', await stateSigningKey(), utf8(encoded)),
  )
  return `${encoded}.${toBase64Url(signature)}`
}

async function verifyState(value: string): Promise<OAuthState> {
  const [encoded, signature] = value.split('.')
  if (!encoded || !signature) throw new Error('حالة ربط Google غير صالحة')
  const valid = await crypto.subtle.verify(
    'HMAC',
    await stateSigningKey(),
    fromBase64Url(signature),
    utf8(encoded),
  )
  if (!valid) {
    throw new Error('تعذر التحقق من أمان ربط Google')
  }
  const state = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as OAuthState
  if (!state.userId || !state.storeId || !state.nonce || state.expiresAt < Date.now()) {
    throw new Error('انتهت صلاحية محاولة ربط Google')
  }
  return state
}

async function loadAccount(accountId: string, storeId: string): Promise<GoogleAccountRow> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('google_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('store_id', storeId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('حساب Google غير موجود أو غير نشط')
  return data as GoogleAccountRow
}

async function refreshAccessToken(account: GoogleAccountRow) {
  const stillValid =
    account.token_expires_at && Date.parse(account.token_expires_at) > Date.now() + 60_000
  if (stillValid) return decryptToken(account.access_token_encrypted)
  if (!account.refresh_token_encrypted) {
    throw new Error('انتهت جلسة Google. احذف الحساب وأعد ربطه.')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: await decryptToken(account.refresh_token_encrypted),
      grant_type: 'refresh_token',
    }),
  })
  const result = (await response.json()) as {
    access_token?: string
    expires_in?: number
    error_description?: string
  }
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || 'تعذر تجديد اتصال Google')
  }

  const expiresAt = new Date(Date.now() + (result.expires_in || 3_600) * 1_000).toISOString()
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('google_accounts')
    .update({
      access_token_encrypted: await encryptToken(result.access_token),
      token_expires_at: expiresAt,
    })
    .eq('id', account.id)
    .eq('store_id', account.store_id)
  if (error) throw error
  return result.access_token
}

async function googleJson<T>(account: GoogleAccountRow, url: string): Promise<T> {
  const token = await refreshAccessToken(account)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const result = (await response.json()) as T & { error?: { message?: string } }
  if (!response.ok) {
    throw new Error(result.error?.message || 'تعذر قراءة البيانات من Google')
  }
  return result
}

function toConnection(row: GoogleSheetIntegrationRow) {
  return {
    id: row.id,
    accountId: row.config.googleAccountId,
    accountEmail: row.config.accountEmail,
    spreadsheetId: row.config.spreadsheetId,
    spreadsheetName: row.config.spreadsheetName,
    sheetId: row.config.sheetId,
    sheetTitle: row.config.sheetTitle,
    storeName: row.config.storeName,
    startRow: row.config.startRow,
    mergeVariantProduct: row.config.mergeVariantProduct,
    columnMapping: row.config.columnMapping,
    isActive: row.is_active,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
  }
}

export const getGoogleSheetsOverview = createServerFn({ method: 'GET' }).handler(async () => {
  const userId = await requireAdmin()
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)
  const [{ data: accounts, error: accountError }, { data: connections, error: connectionError }] =
    await Promise.all([
      supabase
        .from('google_accounts')
        .select('id,email,is_active,created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false }),
      supabase
        .from('store_integrations')
        .select('id,external_account_id,config,is_active,last_synced_at,created_at')
        .eq('store_id', storeId)
        .eq('provider', GOOGLE_PROVIDER)
        .order('created_at', { ascending: false }),
    ])
  if (accountError) throw accountError
  if (connectionError) throw connectionError

  return {
    configured: oauthConfigured(),
    redirectUri: googleOAuthRedirectUri(),
    accounts: (accounts || []).map((account) => ({
      id: account.id,
      email: account.email,
      isActive: account.is_active,
      createdAt: account.created_at,
    })),
    connections: ((connections || []) as GoogleSheetIntegrationRow[]).map(toConnection),
  }
})

export const beginGoogleOAuth = createServerFn({ method: 'POST' }).handler(async () => {
  if (!oauthConfigured()) throw new Error('ربط Google يحتاج إعداد Client ID وClient Secret أولًا')
  const userId = await requireAdmin()
  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)
  const nonceBytes = new Uint8Array(24)
  crypto.getRandomValues(nonceBytes)
  const nonce = toBase64Url(nonceBytes)
  const state = await signState({
    userId,
    storeId,
    nonce,
    expiresAt: Date.now() + 10 * 60_000,
  })
  const { setCookie } = await import('@tanstack/react-start/server')
  setCookie(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: appOrigin().startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  })

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: googleOAuthRedirectUri(),
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state,
  })
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` }
})

export async function completeGoogleOAuth(code: string, stateValue: string) {
  if (!oauthConfigured()) throw new Error('ربط Google غير مهيأ')
  const state = await verifyState(stateValue)
  const { deleteCookie, getCookie } = await import('@tanstack/react-start/server')
  const cookieNonce = getCookie(OAUTH_STATE_COOKIE)
  deleteCookie(OAUTH_STATE_COOKIE, { path: '/' })
  if (!cookieNonce || cookieNonce !== state.nonce) {
    throw new Error('جلسة ربط Google غير صالحة. أعد المحاولة من المنصة.')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: googleOAuthRedirectUri(),
    }),
  })
  const tokens = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    error_description?: string
  }
  if (!response.ok || !tokens.access_token) {
    throw new Error(tokens.error_description || 'فشل استلام صلاحية Google')
  }

  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = (await profileResponse.json()) as { sub?: string; email?: string }
  if (!profileResponse.ok || !profile.sub || !profile.email) {
    throw new Error('تعذر قراءة حساب Google')
  }

  const supabase = getSupabaseAdminClient()
  const { data: existing, error: lookupError } = await supabase
    .from('google_accounts')
    .select('id,refresh_token_encrypted')
    .eq('store_id', state.storeId)
    .eq('google_user_id', profile.sub)
    .maybeSingle()
  if (lookupError) throw lookupError

  const accountPayload = {
    store_id: state.storeId,
    connected_by: state.userId,
    google_user_id: profile.sub,
    email: profile.email,
    access_token_encrypted: await encryptToken(tokens.access_token),
    refresh_token_encrypted: tokens.refresh_token
      ? await encryptToken(tokens.refresh_token)
      : existing?.refresh_token_encrypted || null,
    token_expires_at: new Date(Date.now() + (tokens.expires_in || 3_600) * 1_000).toISOString(),
    scopes: (tokens.scope || GOOGLE_SCOPES.join(' ')).split(' '),
    is_active: true,
  }
  const { data: account, error: saveError } = existing
    ? await supabase
        .from('google_accounts')
        .update(accountPayload)
        .eq('id', existing.id)
        .select('id')
        .single()
    : await supabase.from('google_accounts').insert(accountPayload).select('id').single()
  if (saveError) throw saveError

  await supabase.from('audit_log').insert({
    actor_id: state.userId,
    store_id: state.storeId,
    action: 'connect_google_account',
    new_value: { googleAccountId: account.id, email: profile.email },
  })
  return { accountId: account.id, email: profile.email }
}

export const listGoogleSpreadsheets = createServerFn({ method: 'POST' })
  .validator((data: { accountId: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireAdmin()
    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const account = await loadAccount(data.accountId, storeId)
    const params = new URLSearchParams({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: 'files(id,name,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: '100',
      spaces: 'drive',
    })
    const result = await googleJson<{
      files?: Array<{ id: string; name: string; modifiedTime?: string }>
    }>(account, `https://www.googleapis.com/drive/v3/files?${params.toString()}`)
    return result.files || []
  })

export const listGoogleSpreadsheetSheets = createServerFn({ method: 'POST' })
  .validator((data: { accountId: string; spreadsheetId: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireAdmin()
    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const account = await loadAccount(data.accountId, storeId)
    const fields = encodeURIComponent('sheets.properties(sheetId,title,index,hidden)')
    const result = await googleJson<{
      sheets?: Array<{
        properties: { sheetId: number; title: string; index: number; hidden?: boolean }
      }>
    }>(
      account,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(data.spreadsheetId)}?fields=${fields}`,
    )
    return (result.sheets || [])
      .map((sheet) => sheet.properties)
      .filter((sheet) => !sheet.hidden)
      .sort((a, b) => a.index - b.index)
  })

function a1SheetName(title: string) {
  return `'${title.replace(/'/g, "''")}'`
}

export const getGoogleSheetHeaders = createServerFn({ method: 'POST' })
  .validator(
    (data: { accountId: string; spreadsheetId: string; sheetTitle: string; startRow: number }) =>
      data,
  )
  .handler(async ({ data }) => {
    const userId = await requireAdmin()
    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const account = await loadAccount(data.accountId, storeId)
    const startRow = Math.max(2, Math.min(Math.floor(data.startRow || 2), 10_000))
    const range = encodeURIComponent(
      `${a1SheetName(data.sheetTitle)}!A${startRow - 1}:ZZ${startRow - 1}`,
    )
    const result = await googleJson<{ values?: unknown[][] }>(
      account,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(data.spreadsheetId)}/values/${range}?majorDimension=ROWS`,
    )
    const headers = (result.values?.[0] || []).map((value) => String(value ?? '').trim())
    if (!headers.some(Boolean)) throw new Error('لم نجد عناوين الأعمدة في السطر المحدد')
    return { headers, headerRow: startRow - 1 }
  })

export const saveGoogleSheetConnection = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      id?: string
      accountId: string
      accountEmail: string
      spreadsheetId: string
      spreadsheetName: string
      sheetId: number
      sheetTitle: string
      storeName: string
      startRow: number
      mergeVariantProduct: boolean
      columnMapping: GoogleSheetColumnMapping
    }) => data,
  )
  .handler(async ({ data }) => {
    const userId = await requireAdmin()
    const missing = validateGoogleSheetMapping(data.columnMapping)
    if (missing.length) throw new Error(`اربط الحقول المطلوبة: ${missing.join('، ')}`)
    if (!data.storeName.trim()) throw new Error('اسم المتجر مطلوب')

    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const account = await loadAccount(data.accountId, storeId)
    if (account.email !== data.accountEmail) throw new Error('بيانات حساب Google غير متطابقة')

    const config: GoogleSheetConfig = {
      googleAccountId: data.accountId,
      accountEmail: account.email,
      spreadsheetId: data.spreadsheetId,
      spreadsheetName: data.spreadsheetName.trim().slice(0, 180),
      sheetId: Number(data.sheetId),
      sheetTitle: data.sheetTitle.trim().slice(0, 180),
      storeName: data.storeName.trim().slice(0, 80),
      startRow: Math.max(2, Math.min(Math.floor(data.startRow || 2), 10_000)),
      mergeVariantProduct: Boolean(data.mergeVariantProduct),
      columnMapping: data.columnMapping,
      version: 1,
    }
    const externalAccountId = `${data.accountId}:${data.spreadsheetId}:${data.sheetId}`

    let query
    if (data.id) {
      query = supabase
        .from('store_integrations')
        .update({ external_account_id: externalAccountId, config })
        .eq('id', data.id)
        .eq('store_id', storeId)
        .eq('provider', GOOGLE_PROVIDER)
    } else {
      query = supabase.from('store_integrations').insert({
        store_id: storeId,
        provider: GOOGLE_PROVIDER,
        external_account_id: externalAccountId,
        config,
        is_active: true,
      })
    }
    const { data: saved, error } = await query
      .select('id,external_account_id,config,is_active,last_synced_at,created_at')
      .single()
    if (error) {
      if (error.code === '23505') throw new Error('هذه الصفحة مربوطة بالفعل')
      throw error
    }

    await supabase.from('audit_log').insert({
      actor_id: userId,
      store_id: storeId,
      action: data.id ? 'update_google_sheet_connection' : 'create_google_sheet_connection',
      new_value: {
        integrationId: saved.id,
        accountEmail: account.email,
        spreadsheetName: config.spreadsheetName,
        sheetTitle: config.sheetTitle,
      },
    })
    return toConnection(saved as GoogleSheetIntegrationRow)
  })

export const setGoogleSheetConnectionActive = createServerFn({ method: 'POST' })
  .validator((data: { id: string; isActive: boolean }) => data)
  .handler(async ({ data }) => {
    const userId = await requireAdmin()
    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const { data: updated, error } = await supabase
      .from('store_integrations')
      .update({ is_active: Boolean(data.isActive) })
      .eq('id', data.id)
      .eq('store_id', storeId)
      .eq('provider', GOOGLE_PROVIDER)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!updated) throw new Error('ربط Google Sheet غير موجود')
    return { success: true }
  })

export const deleteGoogleSheetConnection = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireAdmin()
    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const { data: connection, error: lookupError } = await supabase
      .from('store_integrations')
      .select('id,config')
      .eq('id', data.id)
      .eq('store_id', storeId)
      .eq('provider', GOOGLE_PROVIDER)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!connection) throw new Error('ربط Google Sheet غير موجود')
    const { error } = await supabase
      .from('store_integrations')
      .delete()
      .eq('id', data.id)
      .eq('store_id', storeId)
      .eq('provider', GOOGLE_PROVIDER)
    if (error) throw error
    await supabase.from('audit_log').insert({
      actor_id: userId,
      store_id: storeId,
      action: 'delete_google_sheet_connection',
      old_value: { integrationId: data.id, config: connection.config },
    })
    return { success: true }
  })

export const deleteGoogleAccount = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireAdmin()
    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const { data: account, error: lookupError } = await supabase
      .from('google_accounts')
      .select('id,email')
      .eq('id', data.id)
      .eq('store_id', storeId)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!account) throw new Error('حساب Google غير موجود')
    const { data: connections, error: connectionError } = await supabase
      .from('store_integrations')
      .select('id,config')
      .eq('store_id', storeId)
      .eq('provider', GOOGLE_PROVIDER)
    if (connectionError) throw connectionError
    const linkedIds = (connections || [])
      .filter(
        (connection) =>
          (connection.config as GoogleSheetConfig | null)?.googleAccountId === data.id,
      )
      .map((connection) => connection.id)
    if (linkedIds.length) {
      throw new Error('احذف روابط الشيت التابعة لهذا الحساب قبل حذف الحساب')
    }
    const { error } = await supabase
      .from('google_accounts')
      .delete()
      .eq('id', data.id)
      .eq('store_id', storeId)
    if (error) throw error
    await supabase.from('audit_log').insert({
      actor_id: userId,
      store_id: storeId,
      action: 'delete_google_account',
      old_value: { googleAccountId: data.id, email: account.email },
    })
    return { success: true }
  })

export const syncGoogleSheetConnection = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const userId = await requireAdmin()
    const supabase = getSupabaseAdminClient()
    const storeId = await resolveDefaultStoreId(userId, supabase)
    const { data: connection, error: connectionError } = await supabase
      .from('store_integrations')
      .select('id,config,is_active')
      .eq('id', data.id)
      .eq('store_id', storeId)
      .eq('provider', GOOGLE_PROVIDER)
      .maybeSingle()
    if (connectionError) throw connectionError
    if (!connection) throw new Error('ربط Google Sheet غير موجود')
    if (!connection.is_active) throw new Error('فعّل الربط قبل المزامنة')
    const config = connection.config as GoogleSheetConfig
    const missing = validateGoogleSheetMapping(config.columnMapping)
    if (missing.length) throw new Error(`المطابقة ناقصة: ${missing.join('، ')}`)
    const account = await loadAccount(config.googleAccountId, storeId)
    const syncStartedAt = new Date()
    const syncStartedAtIso = syncStartedAt.toISOString()
    const syncDateText = formatAlgiersDate(syncStartedAt)

    const range = encodeURIComponent(
      `${a1SheetName(config.sheetTitle)}!A${config.startRow}:ZZ${config.startRow + MAX_IMPORT_ROWS - 1}`,
    )
    const result = await googleJson<{ values?: unknown[][] }>(
      account,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${range}?majorDimension=ROWS`,
    )
    const values = result.values || []
    const { data: syncRun, error: runError } = await supabase
      .from('order_sync_runs')
      .insert({
        store_id: storeId,
        provider: GOOGLE_PROVIDER,
        direction: 'import',
        status: 'running',
        scanned_count: values.length,
        started_by: userId,
      })
      .select('id')
      .single()
    if (runError) throw runError

    try {
      const sourceRows: Array<Record<string, unknown>> = []
      const missingDateSourceIds = new Set<string>()
      let skipped = 0
      for (let index = 0; index < values.length; index += 1) {
        const mapped = mapGoogleSheetRow(values[index], config.columnMapping)
        const customerName = String(mapped.customerName || '').trim()
        const phone = String(mapped.phone || '').trim()
        let product = String(mapped.product || '').trim()
        const color = String(mapped.color || '').trim()
        const size = String(mapped.size || '').trim()
        if (!customerName || !phone || !product) {
          skipped += 1
          continue
        }
        if (config.mergeVariantProduct) {
          product = [product, color, size].filter(Boolean).join(' - ')
        }
        const sheetRow = config.startRow + index
        const providedOrderId = String(mapped.orderId || '').trim()
        const displayOrderId =
          providedOrderId || generateOrderId(phone, String(mapped.date || ''), product)
        const stablePart = providedOrderId ? `order:${providedOrderId}` : `row:${sheetRow}`
        const sourceOrderId = `gsh:${connection.id}:${stablePart}`
        const sourceDateText = String(mapped.date || '').trim()
        if (!sourceDateText) missingDateSourceIds.add(sourceOrderId)
        const suppliedStatus = String(mapped.status || '').trim()
        const status = ALL_STATUSES.includes(suppliedStatus as (typeof ALL_STATUSES)[number])
          ? suppliedStatus
          : STATUS.PROCESSING
        sourceRows.push({
          store_id: storeId,
          source: 'google_oauth',
          source_order_id: sourceOrderId,
          sheet_row: null,
          customer_name: customerName,
          phone,
          wilaya: String(mapped.wilaya || '').trim(),
          baladiya: String(mapped.baladiya || '').trim(),
          address: String(mapped.address || '').trim(),
          notes: String(mapped.notes || '').trim(),
          product,
          color,
          size,
          price: parseOrderPrice(mapped.price),
          quantity: Math.max(parseOrderQuantity(mapped.quantity), 1),
          delivery_type: String(mapped.deliveryType || '').trim(),
          ordered_at: parseOrderDate(sourceDateText) || (!sourceDateText ? syncStartedAtIso : null),
          ordered_at_text: sourceDateText || syncDateText,
          status,
          raw_data: {
            importedFrom: GOOGLE_PROVIDER,
            integrationId: connection.id,
            spreadsheetId: config.spreadsheetId,
            sheetId: config.sheetId,
            sheetRow,
            displayOrderId,
          },
          last_synced_at: new Date().toISOString(),
          deleted_at: null,
        })
      }

      const sourceIds = sourceRows.map((row) => String(row.source_order_id))
      const existingIds = new Set<string>()
      const existingDateBySourceId = new Map<
        string,
        { ordered_at: string | null; ordered_at_text: string; created_at: string }
      >()
      for (let index = 0; index < sourceIds.length; index += 250) {
        const group = sourceIds.slice(index, index + 250)
        const { data: existing, error } = await supabase
          .from('orders')
          .select('source_order_id,ordered_at,ordered_at_text,created_at')
          .eq('store_id', storeId)
          .eq('source', 'google_oauth')
          .in('source_order_id', group)
        if (error) throw error
        for (const row of existing || []) {
          existingIds.add(row.source_order_id)
          existingDateBySourceId.set(row.source_order_id, row)
        }
      }

      for (const row of sourceRows) {
        const sourceOrderId = String(row.source_order_id)
        if (!missingDateSourceIds.has(sourceOrderId)) continue
        const existing = existingDateBySourceId.get(sourceOrderId)
        if (!existing) continue

        const fallbackIso = existing.ordered_at || existing.created_at || syncStartedAtIso
        row.ordered_at = fallbackIso
        row.ordered_at_text =
          existing.ordered_at_text?.trim() || formatAlgiersDate(new Date(fallbackIso))
      }

      for (let index = 0; index < sourceRows.length; index += 250) {
        const { error } = await supabase
          .from('orders')
          .upsert(sourceRows.slice(index, index + 250), {
            onConflict: 'store_id,source,source_order_id',
          })
        if (error) throw error
      }
      const updated = sourceRows.filter((row) =>
        existingIds.has(String(row.source_order_id)),
      ).length
      const inserted = sourceRows.length - updated
      const now = new Date().toISOString()
      const [{ error: integrationUpdateError }, { error: runUpdateError }] = await Promise.all([
        supabase
          .from('store_integrations')
          .update({ last_synced_at: now })
          .eq('id', connection.id)
          .eq('store_id', storeId),
        supabase
          .from('order_sync_runs')
          .update({
            status: 'completed',
            inserted_count: inserted,
            updated_count: updated,
            skipped_count: skipped,
            finished_at: now,
          })
          .eq('id', syncRun.id),
      ])
      if (integrationUpdateError) throw integrationUpdateError
      if (runUpdateError) throw runUpdateError
      return { scanned: values.length, inserted, updated, skipped }
    } catch (error) {
      await supabase
        .from('order_sync_runs')
        .update({
          status: 'failed',
          error_count: 1,
          error_summary: [
            { message: error instanceof Error ? error.message : 'Google Sheets sync failed' },
          ],
          finished_at: new Date().toISOString(),
        })
        .eq('id', syncRun.id)
      throw error
    }
  })
