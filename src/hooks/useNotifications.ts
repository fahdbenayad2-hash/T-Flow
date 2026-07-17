import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useOrders } from '~/lib/queries'
import { supabase } from '~/utils/supabase-client'
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
  const queryClient = useQueryClient()
  const [realtimeEnabled, setRealtimeEnabled] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url || url.includes('your-project')) return

    try {
      channelRef.current = supabase
        .channel('orders-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'audit_log' },
          () => {
            queryClient.invalidateQueries({ queryKey: ['orders'] })
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeEnabled(true)
          }
        })
    } catch {
      // Supabase not configured, fall back to polling
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [queryClient])

  const query = useQuery({
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
    refetchInterval: realtimeEnabled ? false : 60_000,
    staleTime: realtimeEnabled ? 10_000 : 30_000,
  })

  return {
    ...query,
    realtimeEnabled,
  }
}
