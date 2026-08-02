import { describe, expect, it } from 'vitest'
import { nextSimulatedShipmentStatus } from './delivery-simulator'

describe('delivery simulator transitions', () => {
  it('advances a ready shipment to in transit', () => {
    expect(nextSimulatedShipmentStatus('ready', 'advance')).toBe('in_transit')
  })

  it('advances an in-transit shipment to delivered', () => {
    expect(nextSimulatedShipmentStatus('in_transit', 'advance')).toBe('delivered')
  })

  it('can simulate an exception before delivery', () => {
    expect(nextSimulatedShipmentStatus('ready', 'exception')).toBe('exception')
    expect(nextSimulatedShipmentStatus('in_transit', 'exception')).toBe('exception')
  })

  it('does not alter terminal shipments', () => {
    expect(() => nextSimulatedShipmentStatus('delivered', 'advance')).toThrow('حالة نهائية')
    expect(() => nextSimulatedShipmentStatus('exception', 'advance')).toThrow('حالة نهائية')
  })
})
