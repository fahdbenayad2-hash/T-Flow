import { describe, expect, it } from 'vitest'
import { buildSystemHealth, type SystemHealthInput } from './system-health'

const HEALTHY_INPUT: SystemHealthInput = {
  activeSheets: 1,
  lastSheetSyncAt: '2026-08-03T09:00:00.000Z',
  failedSyncRuns24h: 0,
  pendingWritebacks: 2,
  failedWritebacks: 0,
  activeWebhooks: 1,
  rejectedWebhooks24h: 0,
  deliveryExceptions: 0,
  carrierStatus: 'connected',
}

describe('system health', () => {
  it('reports a healthy system when all operational signals are clean', () => {
    const health = buildSystemHealth(HEALTHY_INPUT, new Date('2026-08-03T10:00:00.000Z'))
    expect(health.status).toBe('healthy')
    expect(health.score).toBe(100)
  })

  it('raises critical checks for failed syncs and writebacks', () => {
    const health = buildSystemHealth(
      { ...HEALTHY_INPUT, failedSyncRuns24h: 1, failedWritebacks: 3 },
      new Date('2026-08-03T10:00:00.000Z'),
    )
    expect(health.status).toBe('critical')
    expect(health.criticalCount).toBe(2)
    expect(health.checks.find((check) => check.id === 'writeback')?.status).toBe('critical')
  })

  it('warns when a connected sheet has not synced recently', () => {
    const health = buildSystemHealth(
      { ...HEALTHY_INPUT, lastSheetSyncAt: '2026-08-02T20:00:00.000Z' },
      new Date('2026-08-03T10:00:00.000Z'),
    )
    expect(health.checks.find((check) => check.id === 'google_sheets')?.status).toBe('warning')
  })
})
