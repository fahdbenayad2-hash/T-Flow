import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { inventorySettingsQueryOptions, useOrders, useSystemHealthOverview } from '~/lib/queries'
import { supabase } from '~/utils/supabase-client'
import { useTenantId } from '~/hooks/useTenantScope'
import { useRole } from '~/hooks/useRole'
import { buildSmartAlerts } from '~/lib/smart-alerts'
import { buildSystemHealthAlerts } from '~/lib/system-health'

export function useNotifications(options: { realtime?: boolean } = {}) {
  const tenantId = useTenantId()
  const { isAdmin } = useRole()
  const ordersQuery = useOrders()
  const inventoryQuery = useQuery({
    ...inventorySettingsQueryOptions(tenantId),
    enabled: isAdmin,
  })
  const healthQuery = useSystemHealthOverview({ enabled: isAdmin })
  const queryClient = useQueryClient()
  const [realtimeEnabled, setRealtimeEnabled] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const shouldSubscribe = options.realtime !== false

  useEffect(() => {
    if (!shouldSubscribe) return
    const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url || url.includes('your-project')) return

    try {
      channelRef.current = supabase
        .channel('orders-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_log' }, () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] })
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        })
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
  }, [queryClient, shouldSubscribe])

  const query = useQuery({
    queryKey: [
      'notifications',
      tenantId,
      ordersQuery.dataUpdatedAt,
      isAdmin ? inventoryQuery.dataUpdatedAt : 0,
      isAdmin ? healthQuery.dataUpdatedAt : 0,
    ],
    queryFn: () =>
      [
        ...buildSmartAlerts(
          ordersQuery.data?.orders ?? [],
          isAdmin ? (inventoryQuery.data ?? []) : [],
        ),
        ...buildSystemHealthAlerts(isAdmin ? healthQuery.data?.health : undefined),
      ].slice(0, 25),
    enabled:
      !!ordersQuery.data &&
      (!isAdmin || (inventoryQuery.isSuccess && (healthQuery.isSuccess || healthQuery.isError))),
    refetchInterval: realtimeEnabled ? false : 60_000,
    staleTime: realtimeEnabled ? 10_000 : 30_000,
  })

  return {
    ...query,
    realtimeEnabled,
  }
}
