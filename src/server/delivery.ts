import { createServerFn } from '@tanstack/react-start'
import { DEMO_MODE_SERVER as DEMO_MODE } from '~/config'
import type { AppRole } from '~/lib/types'
import type { DeliveryShipmentAssignment } from '~/lib/delivery-shipment'
import { getSupabaseAdminClient } from '~/utils/supabase-server'
import { requireUser } from './auth'
import { resolveDefaultStoreId } from './order-repository'

type ShipmentOrderInput = {
  sourceOrderId?: string
  sheetRow?: number
}

async function requireDeliveryOperator() {
  const userId = await requireUser()
  if (DEMO_MODE) return { userId, storeId: 'demo-store' }

  const supabase = getSupabaseAdminClient()
  const storeId = await resolveDefaultStoreId(userId, supabase)
  const { data, error } = await supabase
    .from('store_members')
    .select('role')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .eq('is_active', true)
  if (error) throw error

  const roles = (data || []).map((row) => row.role) as AppRole[]
  if (!roles.some((role) => role === 'admin' || role === 'shipping_manager')) {
    throw new Error('FORBIDDEN')
  }
  return { userId, storeId }
}

function makeBatchReference() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase()
  return `TFB-${date}-${suffix}`
}

function makeTrackingNumber(sourceOrderId: string) {
  return `TF-${sourceOrderId}`.replace(/\s+/g, '-').slice(0, 120)
}

export const getDeliveryShipments = createServerFn({ method: 'GET' }).handler(async () => {
  const { storeId } = await requireDeliveryOperator()
  if (DEMO_MODE) return [] as DeliveryShipmentAssignment[]

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('delivery_shipments')
    .select(
      'id,batch_id,order_id,tracking_number,status,created_at,delivery_batches!inner(reference,carrier),orders!inner(source_order_id,sheet_row)',
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data || []).map((row) => {
    const batch = row.delivery_batches as unknown as { reference: string; carrier: string }
    const order = row.orders as unknown as { source_order_id: string; sheet_row: number | null }
    return {
      id: row.id,
      batchId: row.batch_id,
      batchReference: batch.reference,
      carrier: batch.carrier,
      orderId: row.order_id,
      sourceOrderId: order.source_order_id,
      sheetRow: order.sheet_row,
      trackingNumber: row.tracking_number,
      status: row.status,
      createdAt: row.created_at,
    } as DeliveryShipmentAssignment
  })
})

export const createDeliveryBatch = createServerFn({ method: 'POST' })
  .validator((data: { carrier: string; notes?: string; orders: ShipmentOrderInput[] }) => data)
  .handler(async ({ data }) => {
    const carrier = data.carrier.trim().slice(0, 100)
    if (!carrier) throw new Error('شركة التوصيل مطلوبة')
    if (!data.orders.length) throw new Error('حدد طلباً واحداً على الأقل')
    if (data.orders.length > 500) throw new Error('الحد الأقصى للدفعة هو 500 طلب')

    const { userId, storeId } = await requireDeliveryOperator()
    const reference = makeBatchReference()
    if (DEMO_MODE) return { id: 'demo-batch', reference, count: data.orders.length }

    const supabase = getSupabaseAdminClient()
    const sourceIds = [
      ...new Set(data.orders.map((item) => item.sourceOrderId).filter(Boolean)),
    ] as string[]
    const sheetRows = [
      ...new Set(data.orders.map((item) => item.sheetRow).filter(Number.isInteger)),
    ] as number[]
    const found = new Map<string, { id: string; source_order_id: string }>()

    if (sourceIds.length) {
      const { data: rows, error } = await supabase
        .from('orders')
        .select('id,source_order_id')
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .in('source_order_id', sourceIds)
      if (error) throw error
      for (const row of rows || []) found.set(row.id, row)
    }
    if (sheetRows.length) {
      const { data: rows, error } = await supabase
        .from('orders')
        .select('id,source_order_id')
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .in('sheet_row', sheetRows)
      if (error) throw error
      for (const row of rows || []) found.set(row.id, row)
    }

    if (found.size !== data.orders.length) {
      throw new Error(`تم العثور على ${found.size} من أصل ${data.orders.length} طلب`)
    }

    const { data: batch, error: batchError } = await supabase
      .from('delivery_batches')
      .insert({
        store_id: storeId,
        reference,
        carrier,
        notes: String(data.notes || '')
          .trim()
          .slice(0, 500),
        created_by: userId,
      })
      .select('id,reference')
      .single()
    if (batchError) throw batchError

    const shipments = [...found.values()].map((order) => ({
      store_id: storeId,
      batch_id: batch.id,
      order_id: order.id,
      tracking_number: makeTrackingNumber(order.source_order_id),
      status: 'ready',
    }))
    const { error: shipmentError } = await supabase.from('delivery_shipments').upsert(shipments, {
      onConflict: 'store_id,order_id',
    })
    if (shipmentError) {
      await supabase.from('delivery_batches').delete().eq('id', batch.id).eq('store_id', storeId)
      throw shipmentError
    }

    await supabase.from('audit_log').insert({
      store_id: storeId,
      actor_id: userId,
      action: 'create_delivery_batch',
      new_value: { batchId: batch.id, reference, carrier, count: shipments.length },
    })

    return { id: batch.id, reference: batch.reference, count: shipments.length }
  })
