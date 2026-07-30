import { describe, expect, it } from 'vitest'
import { buildCallQueue, getTodayCallStats } from './call-center-insights'
import { STATUS } from './sheet-mapping'
import type { CallLog, Order } from './types'

function order(overrides: Partial<Order> = {}): Order {
  return {
    _row: 2,
    order_id: 'TF-1',
    customerName: 'عميل',
    phone: '0550000000',
    wilaya: 'الجزائر',
    baladiya: 'الجزائر الوسطى',
    address: '',
    notes: '',
    product: 'منتج',
    color: '',
    size: '',
    price: 1000,
    quantity: 1,
    deliveryType: 'منزل',
    date: '2026-07-30',
    status: STATUS.PROCESSING,
    ...overrides,
  }
}

function log(overrides: Partial<CallLog> = {}): CallLog {
  return {
    id: 'log-1',
    order_id: 'TF-1',
    agent_id: 'agent-1',
    outcome: 'postponed',
    note: '',
    follow_up_at: '2026-07-30T09:00:00.000Z',
    created_at: '2026-07-30T08:00:00.000Z',
    ...overrides,
  }
}

describe('call center insights', () => {
  it('puts due follow-ups first', () => {
    const queue = buildCallQueue(
      [order(), order({ _row: 3, order_id: 'TF-2', customerName: 'عميل جديد' })],
      [log()],
      new Date('2026-07-30T10:00:00.000Z'),
    )

    expect(queue[0]).toMatchObject({ bucket: 'due', attempts: 1 })
    expect(queue[1].bucket).toBe('new')
  })

  it('keeps future follow-ups scheduled after actionable calls', () => {
    const queue = buildCallQueue(
      [order()],
      [log({ follow_up_at: '2026-07-31T09:00:00.000Z' })],
      new Date('2026-07-30T10:00:00.000Z'),
    )

    expect(queue[0]).toMatchObject({ bucket: 'scheduled', priority: 3 })
  })

  it('includes no-answer orders as retries', () => {
    const queue = buildCallQueue([order({ status: STATUS.NO_ANSWER })], [])
    expect(queue[0].bucket).toBe('retry')
  })

  it('calculates persistent daily stats from logs', () => {
    const stats = getTodayCallStats(
      [
        log({ outcome: 'answered', created_at: '2026-07-30T08:00:00.000Z' }),
        log({ id: 'log-2', outcome: 'no_answer', created_at: '2026-07-30T09:00:00.000Z' }),
        log({ id: 'old', outcome: 'answered', created_at: '2026-07-29T09:00:00.000Z' }),
      ],
      new Date('2026-07-30T12:00:00.000Z'),
    )

    expect(stats).toEqual({ answered: 1, noAnswer: 1, postponed: 0, total: 2 })
  })
})
