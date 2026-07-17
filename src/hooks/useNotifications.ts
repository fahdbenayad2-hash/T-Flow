import { useQuery } from '@tanstack/react-query'
import { useOrders } from '~/lib/queries'
import type { Notification } from '~/lib/types'

function isPendingOver48h(dateStr: string): boolean {
  if (!dateStr) return false
  try {
    const clean = dateStr.replace(/[‎‏]/g, '').trim()
    const parts = clean.split(/[,/:\s]+/)
    if (parts.length < 5) return false

    const day = parseInt(parts[0])
    const month = parseInt(parts[1])
    const year = parseInt(parts[2]) || 2026
    const hourStr = parts[3] || '0'
    const minStr = parts[4] || '0'
    const isPM = parts[5] === 'م' || parts[5] === 'ص'

    let hour = parseInt(hourStr)
    if (isPM && hour < 12) hour += 12
    if (!isPM && hour === 12) hour = 0

    const orderDate = new Date(year, month - 1, day, hour, parseInt(minStr))
    const now = new Date()
    const diffHours = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60)
    return diffHours > 48
  } catch {
    return false
  }
}

export function useNotifications() {
  const { data } = useOrders()

  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const notifications: Notification[] = []

      if (data?.orders) {
        const orders = data.orders

        for (const order of orders) {
          if (order['الحالة'] === 'قيد المعالجة' && isPendingOver48h(order['التاريخ'])) {
            notifications.push({
              type: 'pending_order',
              message: `طلب معلق +48 ساعة: ${order['الاسم']}`,
              orderId: order.order_id,
              createdAt: order['التاريخ'],
            })
          }
        }

        const phoneMap = new Map<string, typeof orders>()
        for (const order of orders) {
          const phone = String(order['الهاتف'])
          if (!phoneMap.has(phone)) phoneMap.set(phone, [])
          phoneMap.get(phone)!.push(order)
        }

        for (const [, phoneOrders] of phoneMap) {
          if (phoneOrders.length > 1) {
            const dates = phoneOrders.map((o) => o['التاريخ']).filter(Boolean)
            if (dates.length >= 2) {
              notifications.push({
                type: 'duplicate_order',
                message: `طلب مكرر: ${phoneOrders[0]['الاسم']} (${phoneOrders.length} طلبات)`,
                orderId: phoneOrders[0].order_id,
              })
            }
          }
        }
      }

      return notifications
    },
    enabled: !!data,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
