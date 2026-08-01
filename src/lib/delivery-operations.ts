import { STATUS } from './sheet-mapping'
import type { Order } from './types'
import { getOrderTotal } from './order-record'

export type DeliveryStage = 'ready' | 'in_transit' | 'delivered' | 'exception'

export interface DeliveryItem {
  order: Order
  stage: DeliveryStage
  amount: number
  isHomeDelivery: boolean
}

export function isHomeDeliveryType(deliveryType: string) {
  const normalized = deliveryType.trim().toLowerCase()
  return (
    normalized.includes('دوميسيل') || normalized.includes('منزل') || normalized.includes('home')
  )
}

export function buildDeliveryItems(orders: Order[]): DeliveryItem[] {
  return orders
    .filter((order) =>
      (
        [
          STATUS.CONFIRMED,
          STATUS.PREPARING,
          STATUS.SHIPPED,
          STATUS.DELIVERED,
          STATUS.CANCELLED,
        ] as string[]
      ).includes(order.status),
    )
    .map((order) => {
      let stage: DeliveryStage = 'ready'
      if (order.status === STATUS.SHIPPED) stage = 'in_transit'
      else if (order.status === STATUS.DELIVERED) stage = 'delivered'
      else if (order.status === STATUS.CANCELLED) stage = 'exception'

      return {
        order,
        stage,
        amount: getOrderTotal(order),
        isHomeDelivery: isHomeDeliveryType(order.deliveryType),
      }
    })
    .sort((a, b) => {
      const priority: Record<DeliveryStage, number> = {
        ready: 0,
        in_transit: 1,
        exception: 2,
        delivered: 3,
      }
      return priority[a.stage] - priority[b.stage] || b.order._row - a.order._row
    })
}

export function getDeliveryStats(items: DeliveryItem[]) {
  return {
    ready: items.filter((item) => item.stage === 'ready').length,
    inTransit: items.filter((item) => item.stage === 'in_transit').length,
    delivered: items.filter((item) => item.stage === 'delivered').length,
    exceptions: items.filter((item) => item.stage === 'exception').length,
    collectableAmount: items
      .filter((item) => item.stage === 'ready' || item.stage === 'in_transit')
      .reduce((sum, item) => sum + item.amount, 0),
  }
}
