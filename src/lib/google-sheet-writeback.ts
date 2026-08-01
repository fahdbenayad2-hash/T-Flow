import type { GoogleSheetColumnMapping } from './google-sheet-mapping'

export interface GoogleSheetWritePayload {
  sheetRow: number
  status?: unknown
  notes?: unknown
}

export interface GoogleSheetValueUpdate {
  range: string
  values: unknown[][]
}

export function googleSheetColumnName(index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new Error('INVALID_GOOGLE_SHEET_COLUMN')

  let value = index + 1
  let result = ''
  while (value > 0) {
    value -= 1
    result = String.fromCharCode(65 + (value % 26)) + result
    value = Math.floor(value / 26)
  }
  return result
}

export function quoteGoogleSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`
}

export function buildGoogleSheetWriteData(
  sheetTitle: string,
  mapping: GoogleSheetColumnMapping,
  payload: GoogleSheetWritePayload,
): GoogleSheetValueUpdate[] {
  const sheetRow = Math.floor(Number(payload.sheetRow))
  if (!Number.isFinite(sheetRow) || sheetRow < 2) return []

  const sheet = quoteGoogleSheetTitle(sheetTitle)
  const updates: GoogleSheetValueUpdate[] = []
  const add = (field: 'status' | 'notes', value: unknown) => {
    const column = mapping[field]
    if (!Number.isInteger(column)) return
    updates.push({
      range: `${sheet}!${googleSheetColumnName(column as number)}${sheetRow}`,
      values: [[value ?? '']],
    })
  }

  add('status', payload.status)
  add('notes', payload.notes)
  return updates
}
