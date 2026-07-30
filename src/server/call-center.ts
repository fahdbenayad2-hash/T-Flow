import { createServerFn } from '@tanstack/react-start'
import { DEMO_MODE_SERVER as DEMO_MODE } from '~/config'
import type { AppRole, CallLog } from '~/lib/types'
import { getSupabaseAdminClient } from '~/utils/supabase-server'
import { fetchUserRoles, requireUser } from './auth'

export type CallOutcome = CallLog['outcome']

export const getCallLogs = createServerFn({ method: 'GET' }).handler(async () => {
  const userId = await requireUser()
  if (DEMO_MODE) return [] as CallLog[]

  const roles = (await fetchUserRoles({ data: userId })) as AppRole[]
  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from('call_logs')
    .select('id, order_id, agent_id, outcome, note, follow_up_at, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (!roles.includes('admin')) {
    query = query.eq('agent_id', userId)
  }

  const { data, error } = await query
  if (error) throw error

  return (data || []) as CallLog[]
})

export const recordCallLog = createServerFn({ method: 'POST' })
  .validator(
    (data: { orderId: string; outcome: CallOutcome; note?: string; followUpAt?: string | null }) =>
      data,
  )
  .handler(async ({ data }) => {
    const userId = await requireUser()
    const allowedOutcomes: CallOutcome[] = ['answered', 'no_answer', 'postponed']

    if (!data.orderId.trim() || !allowedOutcomes.includes(data.outcome)) {
      throw new Error('بيانات المكالمة غير صالحة')
    }

    if (data.outcome === 'postponed' && !data.followUpAt) {
      throw new Error('حدد موعد المتابعة')
    }

    if (DEMO_MODE) {
      return {
        id: `demo-${Date.now()}`,
        order_id: data.orderId,
        agent_id: userId,
        outcome: data.outcome,
        note: data.note?.trim() || '',
        follow_up_at: data.followUpAt || null,
        created_at: new Date().toISOString(),
      } satisfies CallLog
    }

    const supabase = getSupabaseAdminClient()
    const { data: log, error } = await supabase
      .from('call_logs')
      .insert({
        order_id: data.orderId,
        agent_id: userId,
        outcome: data.outcome,
        note: data.note?.trim() || null,
        follow_up_at: data.outcome === 'postponed' ? data.followUpAt : null,
      })
      .select('id, order_id, agent_id, outcome, note, follow_up_at, created_at')
      .single()

    if (error) throw error
    return log as CallLog
  })
