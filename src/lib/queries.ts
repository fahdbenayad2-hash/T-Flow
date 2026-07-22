import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, updateOrder, getAuditLog, invalidateOrdersCache } from '~/server/orders'
import type { Order, AuditEntry } from './types'

export const ordersQueryOptions = queryOptions({
  queryKey: ['orders'],
  queryFn: () => getOrders(),
  staleTime: 45_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
})

export function useOrders() {
  return useQuery(ordersQueryOptions)
}

export function useUpdateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { row: number; updates: Record<string, unknown>; lastModified?: string }) => {
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
    mutationFn: async (items: Array<{ row: number; updates: Record<string, unknown> }>) => {
      const results: Array<{ row: number; success: boolean; error?: string }> = []

      for (let i = 0; i < items.length; i++) {
        try {
          const result = await updateOrder({ data: items[i] })
          if (!result.ok) {
            results.push({ row: items[i].row, success: false, error: result.error.message })
          } else {
            results.push({ row: items[i].row, success: true })
          }
        } catch (error) {
          results.push({
            row: items[i].row,
            success: false,
            error: error instanceof Error ? error.message : 'خطأ غير معروف',
          })
        }

        if (i < items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }

      return results
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
