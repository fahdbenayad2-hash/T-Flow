import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getOrders,
  updateOrder,
  batchUpdateOrders,
  deleteOrder,
  getAuditLog,
  invalidateOrdersCache,
} from '~/server/orders'
import { getCallLogs, recordCallLog } from '~/server/call-center'
import type { CallLog } from '~/lib/types'
import { ORDER_CACHE_TTL_S, ORDER_GC_TIME_MS } from '~/config'

export const ordersQueryOptions = queryOptions({
  queryKey: ['orders'],
  queryFn: () => getOrders(),
  staleTime: ORDER_CACHE_TTL_S * 1000,
  gcTime: ORDER_GC_TIME_MS,
  refetchOnWindowFocus: false,
})

export function useOrders() {
  return useQuery(ordersQueryOptions)
}

export function useUpdateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      row: number
      updates: Record<string, unknown>
      lastModified?: number
      order_id?: string
      phone?: string
      product?: string
    }) => {
      const result = await updateOrder({ data })
      if (!result.ok) {
        throw new Error(result.error.message)
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useAuditLog(orderId: string) {
  return useQuery({
    queryKey: ['audit-log', orderId],
    queryFn: () => getAuditLog({ data: { orderId } }),
    enabled: !!orderId,
  })
}

export function useBulkUpdateOrders() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      items: Array<{
        row: number
        updates: Record<string, unknown>
        order_id?: string
        phone?: string
        product?: string
      }>,
    ) => {
      const result = await batchUpdateOrders({ data: { updates: items } })
      if (!result.ok) {
        throw new Error(result.error.message)
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useDeleteOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      row: number
      order_id?: string
      orderData?: Record<string, unknown>
    }) => {
      const result = await deleteOrder({ data })
      if (!result.ok) {
        throw new Error(result.error.message)
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useInvalidateOrdersCache() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => invalidateOrdersCache(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export const callLogsQueryOptions = queryOptions({
  queryKey: ['call-logs'],
  queryFn: () => getCallLogs(),
  staleTime: 15_000,
  refetchOnWindowFocus: true,
})

export function useCallLogs() {
  return useQuery(callLogsQueryOptions)
}

export function useRecordCallLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      orderId: string
      outcome: CallLog['outcome']
      note?: string
      followUpAt?: string | null
    }) => recordCallLog({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-logs'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
