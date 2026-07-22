import { describe, it, expect } from 'vitest'
import { generateOrderId, formatCurrency, STATUS_MAP, STATUS_OPTIONS } from './utils'

describe('generateOrderId', () => {
  it('produces deterministic IDs for same input', () => {
    const id1 = generateOrderId('0555123456', '2025-01-15', 'قميص')
    const id2 = generateOrderId('0555123456', '2025-01-15', 'قميص')
    expect(id1).toBe(id2)
  })

  it('always starts with FS-', () => {
    const id = generateOrderId('0555123456', '2025-01-15', 'قميص')
    expect(id).toMatch(/^FS-/)
  })

  it('produces different IDs for different phones', () => {
    const id1 = generateOrderId('0555123456', '2025-01-15', 'قميص')
    const id2 = generateOrderId('0666789012', '2025-01-15', 'قميص')
    expect(id1).not.toBe(id2)
  })

  it('produces different IDs for different dates', () => {
    const id1 = generateOrderId('0555123456', '2025-01-15', 'قميص')
    const id2 = generateOrderId('0555123456', '2025-01-16', 'قميص')
    expect(id1).not.toBe(id2)
  })

  it('produces different IDs for different products', () => {
    const id1 = generateOrderId('0555123456', '2025-01-15', 'قميص')
    const id2 = generateOrderId('0555123456', '2025-01-15', 'بنطلون')
    expect(id1).not.toBe(id2)
  })

  it('handles numeric phone input', () => {
    const id1 = generateOrderId(555123456, '2025-01-15', 'قميص')
    const id2 = generateOrderId('555123456', '2025-01-15', 'قميص')
    expect(id1).toBe(id2)
  })

  it('produces a short hash string', () => {
    const id = generateOrderId('0555123456', '2025-01-15', 'قميص')
    expect(id.length).toBeLessThan(20)
    expect(id.length).toBeGreaterThan(3)
  })
})

describe('formatCurrency', () => {
  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('0 دج')
  })

  it('formats positive integers', () => {
    expect(formatCurrency(1500)).toContain('دج')
    expect(formatCurrency(1500)).toContain('1')
  })

  it('rounds to integers (no decimal fraction)', () => {
    const result = formatCurrency(1500.75)
    const stripped = result.replace(/\s/g, '').replace('دج', '')
    expect(stripped).not.toMatch(/،|,\d/)  // no Arabic/Western decimal separator followed by digits
  })

  it('handles large numbers', () => {
    const result = formatCurrency(100000)
    expect(result).toContain('دج')
  })
})

describe('STATUS_MAP', () => {
  it('contains all 7 statuses', () => {
    expect(Object.keys(STATUS_MAP)).toHaveLength(7)
  })

  it('has label, color, and var for every status', () => {
    for (const [status, info] of Object.entries(STATUS_MAP)) {
      expect(info.label, `label missing for ${status}`).toBeTruthy()
      expect(info.color, `color missing for ${status}`).toMatch(/^bg-/)
      expect(info.var, `var missing for ${status}`).toMatch(/^--status-/)
    }
  })

  it('includes all expected status strings', () => {
    const expected = [
      'جاري التجهيز', 'قيد المعالجة', 'مؤكد', 'مشحون',
      'تم التسليم', 'ما جاوبش', 'ملغي',
    ]
    for (const s of expected) {
      expect(STATUS_MAP[s], `missing status: ${s}`).toBeDefined()
    }
  })
})

describe('STATUS_OPTIONS', () => {
  it('is derived from STATUS_MAP keys', () => {
    expect(STATUS_OPTIONS).toEqual(Object.keys(STATUS_MAP))
  })

  it('has the same length as STATUS_MAP', () => {
    expect(STATUS_OPTIONS).toHaveLength(Object.keys(STATUS_MAP).length)
  })
})
