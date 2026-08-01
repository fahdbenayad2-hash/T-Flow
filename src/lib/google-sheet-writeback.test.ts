import { describe, expect, it } from 'vitest'
import {
  buildGoogleSheetWriteData,
  googleSheetColumnName,
  quoteGoogleSheetTitle,
} from './google-sheet-writeback'

describe('Google Sheet write-back mapping', () => {
  it('converts zero-based indexes to A1 columns', () => {
    expect(googleSheetColumnName(0)).toBe('A')
    expect(googleSheetColumnName(25)).toBe('Z')
    expect(googleSheetColumnName(26)).toBe('AA')
    expect(googleSheetColumnName(701)).toBe('ZZ')
  })

  it('quotes apostrophes in sheet titles', () => {
    expect(quoteGoogleSheetTitle("Today's orders")).toBe("'Today''s orders'")
  })

  it('builds updates only for mapped operational fields', () => {
    expect(
      buildGoogleSheetWriteData(
        'Orders',
        { status: 4 },
        {
          sheetRow: 17,
          status: 'confirmed',
          notes: 'call later',
        },
      ),
    ).toEqual([{ range: "'Orders'!E17", values: [['confirmed']] }])
  })

  it('rejects invalid sheet rows', () => {
    expect(buildGoogleSheetWriteData('Orders', { status: 1 }, { sheetRow: 0 })).toEqual([])
  })
})
