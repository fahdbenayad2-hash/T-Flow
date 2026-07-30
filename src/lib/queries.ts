import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getOrders,
  updateOrder,
  batchUpdateOrders,
  batchDeleteOrders,
  deleteOrder,
  getAuditLog,
  invalidateOrdersCache,
} from '~/server/orders'
import { getCallLogs, recordCallLog } from '~/server/call-center'
import type { CallLog } from '~/lib/types'
import { getInventorySettings, updateInventorySetting } from '~/server/inventory'
import {
  createStoreConnection,
  deleteStoreConnection,
  getStoreConnections,
  rotateStoreConnectionSecret,
  setStoreConnectionActive,
  updateStoreConnectionLandingPage,
} from '~/server/store-connections'
import {
  beginGoogleOAuth,
  deleteGoogleAccount,
  deleteGoogleSheetConnection,
  getGoogleSheetHeaders,
  getGoogleSheetsOverview,
  listGoogleSpreadsheets,
  listGoogleSpreadsheetSheets,
  saveGoogleSheetConnection,
  setGoogleSheetConnectionActive,
  syncGoogleSheetConnection,
} from '~/server/google-sheets'
import type { GoogleSheetColumnMapping } from '~/lib/google-sheet-mapping'
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

export function useBulkDeleteOrders() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      items: Array<{
        row: number
        order_id?: string
        orderData?: Record<string, unknown>
      }>,
    ) => {
      const result = await batchDeleteOrders({ data: { orders: items } })
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

export const inventorySettingsQueryOptions = queryOptions({
  queryKey: ['inventory-settings'],
  queryFn: () => getInventorySettings(),
  staleTime: 30_000,
})

export function useInventorySettings() {
  return useQuery(inventorySettingsQueryOptions)
}

export function useUpdateInventorySetting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      productName: string
      stockQuantity: number
      lowStockThreshold: number
      unitCost: number
    }) => updateInventorySetting({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-settings'] })
    },
  })
}

export const storeConnectionsQueryOptions = queryOptions({
  queryKey: ['store-connections'],
  queryFn: () => getStoreConnections(),
  staleTime: 10_000,
  refetchOnWindowFocus: true,
})

export function useStoreConnections() {
  return useQuery(storeConnectionsQueryOptions)
}

export function useCreateStoreConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createStoreConnection({ data: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-connections'] })
    },
  })
}

export function useRotateStoreConnectionSecret() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => rotateStoreConnectionSecret({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-connections'] })
    },
  })
}

export function useSetStoreConnectionActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; isActive: boolean }) => setStoreConnectionActive({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-connections'] })
    },
  })
}

export function useDeleteStoreConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteStoreConnection({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-connections'] })
    },
  })
}

export function useUpdateStoreConnectionLandingPage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; enabled: boolean; siteUrl: string }) =>
      updateStoreConnectionLandingPage({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-connections'] })
    },
  })
}

export const googleSheetsOverviewQueryOptions = queryOptions({
  queryKey: ['google-sheets-overview'],
  queryFn: () => getGoogleSheetsOverview(),
  staleTime: 10_000,
  refetchOnWindowFocus: true,
})

export function useGoogleSheetsOverview() {
  return useQuery(googleSheetsOverviewQueryOptions)
}

function useInvalidateGoogleSheetsMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  invalidateOrders = false,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-sheets-overview'] })
      if (invalidateOrders) queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
}

export function useBeginGoogleOAuth() {
  return useMutation({ mutationFn: () => beginGoogleOAuth() })
}

export function useGoogleSpreadsheets() {
  return useMutation({
    mutationFn: (accountId: string) => listGoogleSpreadsheets({ data: { accountId } }),
  })
}

export function useGoogleSpreadsheetSheets() {
  return useMutation({
    mutationFn: (data: { accountId: string; spreadsheetId: string }) =>
      listGoogleSpreadsheetSheets({ data }),
  })
}

export function useGoogleSheetHeaders() {
  return useMutation({
    mutationFn: (data: {
      accountId: string
      spreadsheetId: string
      sheetTitle: string
      startRow: number
    }) => getGoogleSheetHeaders({ data }),
  })
}

export interface SaveGoogleSheetConnectionInput {
  id?: string
  accountId: string
  accountEmail: string
  spreadsheetId: string
  spreadsheetName: string
  sheetId: number
  sheetTitle: string
  storeName: string
  startRow: number
  mergeVariantProduct: boolean
  columnMapping: GoogleSheetColumnMapping
}

export function useSaveGoogleSheetConnection() {
  return useInvalidateGoogleSheetsMutation((data: SaveGoogleSheetConnectionInput) =>
    saveGoogleSheetConnection({ data }),
  )
}

export function useSetGoogleSheetConnectionActive() {
  return useInvalidateGoogleSheetsMutation((data: { id: string; isActive: boolean }) =>
    setGoogleSheetConnectionActive({ data }),
  )
}

export function useDeleteGoogleSheetConnection() {
  return useInvalidateGoogleSheetsMutation((id: string) =>
    deleteGoogleSheetConnection({ data: { id } }),
  )
}

export function useDeleteGoogleAccount() {
  return useInvalidateGoogleSheetsMutation((id: string) => deleteGoogleAccount({ data: { id } }))
}

export function useSyncGoogleSheetConnection() {
  return useInvalidateGoogleSheetsMutation(
    (id: string) => syncGoogleSheetConnection({ data: { id } }),
    true,
  )
}
