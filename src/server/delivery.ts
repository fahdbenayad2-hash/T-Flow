import { createServerFn } from '@tanstack/react-start'
import { DEMO_MODE_SERVER as DEMO_MODE } from '~/config'
import type { AppRole } from '~/lib/types'
import type { DeliveryShipmentAssignment } from '~/lib/delivery-shipment'
import {
  nextSimulatedShipmentStatus,
  simulatedStatusDescription,
  TEST_DELIVERY_CARRIER,
  type SimulationOutcome,
  type ShipmentStatus,
} from '~/lib/delivery-simulator'
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

function makeTrackingNumber(sourceOrderId: string, carrier: string) {
  const prefix = carrier === TEST_DELIVERY_CARRIER ? 'TFT' : 'TF'
  return `${prefix}-${sourceOrderId}`.replace(/\s+/g, '-').slice(0, 120)
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
      tracking_number: makeTrackingNumber(order.source_order_id, carrier),
      status: 'ready',
    }))
    const { data: savedShipments, error: shipmentError } = await supabase
      .from('delivery_shipments')
      .upsert(shipments, {
        onConflict: 'store_id,order_id',
      })
      .select('id')
    if (shipmentError) {
      await supabase.from('delivery_batches').delete().eq('id', batch.id).eq('store_id', storeId)
      throw shipmentError
    }

    if (carrier === TEST_DELIVERY_CARRIER && savedShipments?.length) {
      const { error: eventError } = await supabase.from('delivery_shipment_events').insert(
        savedShipments.map((shipment) => ({
          store_id: storeId,
          shipment_id: shipment.id,
          status: 'ready',
          source: 'simulator',
          description: simulatedStatusDescription('ready'),
          metadata: { batchReference: reference },
          created_by: userId,
        })),
      )
      if (eventError) throw eventError
    }

    await supabase.from('audit_log').insert({
      store_id: storeId,
      actor_id: userId,
      action: 'create_delivery_batch',
      new_value: { batchId: batch.id, reference, carrier, count: shipments.length },
    })

    return { id: batch.id, reference: batch.reference, count: shipments.length }
  })

export const simulateDeliveryShipments = createServerFn({ method: 'POST' })
  .validator((data: { shipmentIds: string[]; outcome: SimulationOutcome }) => data)
  .handler(async ({ data }) => {
    const shipmentIds = [...new Set(data.shipmentIds.map((id) => id.trim()).filter(Boolean))]
    if (!shipmentIds.length) throw new Error('حدد شحنة تجريبية واحدة على الأقل')
    if (shipmentIds.length > 100) throw new Error('الحد الأقصى للمحاكاة هو 100 شحنة')
    if (data.outcome !== 'advance' && data.outcome !== 'exception') {
      throw new Error('نتيجة المحاكاة غير صالحة')
    }

    const { userId, storeId } = await requireDeliveryOperator()
    if (DEMO_MODE) {
      return shipmentIds.map((shipmentId) => ({
        shipmentId,
        status: data.outcome === 'exception' ? 'exception' : 'in_transit',
      }))
    }

    const supabase = getSupabaseAdminClient()
    const { data: rows, error } = await supabase
      .from('delivery_shipments')
      .select('id,status,delivery_batches!inner(carrier)')
      .eq('store_id', storeId)
      .in('id', shipmentIds)
    if (error) throw error
    if ((rows || []).length !== shipmentIds.length) throw new Error('بعض الشحنات غير موجودة')

    const transitions = (rows || []).map((row) => {
      const batch = row.delivery_batches as unknown as { carrier: string }
      if (batch.carrier !== TEST_DELIVERY_CARRIER) {
        throw new Error('المحاكاة متاحة فقط لشحنات T-Flow Test')
      }
      return {
        shipmentId: row.id,
        status: nextSimulatedShipmentStatus(row.status as ShipmentStatus, data.outcome),
      }
    })

    for (const status of ['in_transit', 'delivered', 'exception'] as const) {
      const ids = transitions
        .filter((item) => item.status === status)
        .map((item) => item.shipmentId)
      if (!ids.length) continue
      const updates: Record<string, unknown> = { status }
      if (status === 'in_transit') updates.shipped_at = new Date().toISOString()
      if (status === 'delivered') updates.delivered_at = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('delivery_shipments')
        .update(updates)
        .eq('store_id', storeId)
        .in('id', ids)
      if (updateError) throw updateError
    }

    const { error: eventsError } = await supabase.from('delivery_shipment_events').insert(
      transitions.map((transition) => ({
        store_id: storeId,
        shipment_id: transition.shipmentId,
        status: transition.status,
        source: 'simulator',
        description: simulatedStatusDescription(transition.status),
        metadata: { outcome: data.outcome },
        created_by: userId,
      })),
    )
    if (eventsError) throw eventsError

    await supabase.from('audit_log').insert({
      store_id: storeId,
      actor_id: userId,
      action: 'simulate_delivery_status',
      new_value: { outcome: data.outcome, count: transitions.length },
    })

    return transitions
  })

export const resolveDeliveryExceptions = createServerFn({ method: 'POST' })
  .validator((data: { shipmentIds: string[] }) => data)
  .handler(async ({ data }) => {
    const shipmentIds = [...new Set(data.shipmentIds.map((id) => id.trim()).filter(Boolean))]
    if (!shipmentIds.length) throw new Error('حدد شحنة استثنائية واحدة على الأقل')
    if (shipmentIds.length > 100) throw new Error('الحد الأقصى هو 100 شحنة')

    const { userId, storeId } = await requireDeliveryOperator()
    if (DEMO_MODE)
      return shipmentIds.map((shipmentId) => ({ shipmentId, status: 'ready' as const }))

    const supabase = getSupabaseAdminClient()
    const { data: rows, error } = await supabase
      .from('delivery_shipments')
      .select('id,status')
      .eq('store_id', storeId)
      .eq('status', 'exception')
      .in('id', shipmentIds)
    if (error) throw error
    if ((rows || []).length !== shipmentIds.length) {
      throw new Error('بعض الشحنات ليست في حالة استثناء أو لم تعد موجودة')
    }

    const resolvedAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('delivery_shipments')
      .update({ status: 'ready', shipped_at: null, delivered_at: null })
      .eq('store_id', storeId)
      .in('id', shipmentIds)
    if (updateError) throw updateError

    const { error: eventsError } = await supabase.from('delivery_shipment_events').insert(
      shipmentIds.map((shipmentId) => ({
        store_id: storeId,
        shipment_id: shipmentId,
        status: 'ready',
        source: 'manual',
        description: 'تمت معالجة الاستثناء وإرجاع الشحنة إلى التجهيز',
        metadata: { resolvedAt },
        created_by: userId,
      })),
    )
    if (eventsError) throw eventsError

    await supabase.from('audit_log').insert({
      store_id: storeId,
      actor_id: userId,
      action: 'resolve_delivery_exception',
      new_value: { shipmentIds, count: shipmentIds.length },
    })

    return shipmentIds.map((shipmentId) => ({ shipmentId, status: 'ready' as const }))
  })
