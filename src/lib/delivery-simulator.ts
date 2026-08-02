import type { DeliveryShipmentAssignment } from './delivery-shipment'

export const TEST_DELIVERY_CARRIER = 'T-Flow Test'

export type SimulationOutcome = 'advance' | 'exception'
export type ShipmentStatus = DeliveryShipmentAssignment['status']

export function nextSimulatedShipmentStatus(
  current: ShipmentStatus,
  outcome: SimulationOutcome,
): ShipmentStatus {
  if (current === 'delivered' || current === 'exception') {
    throw new Error('الشحنة وصلت إلى حالة نهائية')
  }
  if (outcome === 'exception') return 'exception'
  return current === 'ready' ? 'in_transit' : 'delivered'
}

export function simulatedStatusDescription(status: ShipmentStatus) {
  if (status === 'in_transit') return 'استلمت شركة T-Flow Test الشحنة وبدأ النقل'
  if (status === 'delivered') return 'تم تسليم الشحنة تجريبياً للعميل'
  if (status === 'exception') return 'تعذر تسليم الشحنة التجريبية'
  return 'تم تجهيز الشحنة التجريبية'
}
