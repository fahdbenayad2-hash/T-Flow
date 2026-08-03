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
  createDeliveryBatch,
  getDeliveryShipments,
  simulateDeliveryShipments,
} from '~/server/delivery'
import type { SimulationOutcome } from '~/lib/delivery-simulator'
import {
  deleteYalidineConnection,
  getDeliveryCarrierConnection,
  saveYalidineConnection,
  testSavedYalidineConnection,
} from '~/server/delivery-carriers'
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
import { useTenantId } from '~/hooks/useTenantScope'
import { getSubscriptionOverview, requestPlanUpgrade } from '~/server/subscriptions'
import type { SubscriptionPlanCode } from './subscription-plans'
import { getSystemHealthOverview, recordBackupExport } from '~/server/system-health'

export const ordersQueryOptions = (tenantId: string) =>
  queryOptions({
    queryKey: ['orders', tenantId],
    queryFn: () => getOrders(),
    staleTime: ORDER_CACHE_TTL_S * 1000,
    gcTime: ORDER_GC_TIME_MS,
    refetchOnWindowFocus: false,
  })

export function useOrders() {
  const tenantId = useTenantId()
  return useQuery(ordersQueryOptions(tenantId))
}

export function useSubscriptionOverview() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['subscription-overview', tenantId],
    queryFn: () => getSubscriptionOverview(),
    staleTime: 30_000,
  })
}

export function useRequestPlanUpgrade() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (planCode: SubscriptionPlanCode) => requestPlanUpgrade({ data: { planCode } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscription-overview'] }),
  })
}

export function useSystemHealthOverview() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['system-health', tenantId],
    queryFn: () => getSystemHealthOverview(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useRecordBackupExport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { orderCount: number; fileName: string; byteSize: number }) =>
      recordBackupExport({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['system-health'] }),
  })
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
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['audit-log', tenantId, orderId],
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

export function useDeliveryShipments() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['delivery-shipments', tenantId],
    queryFn: () => getDeliveryShipments(),
  })
}

export function useCreateDeliveryBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      carrier: string
      notes?: string
      orders: Array<{ sourceOrderId?: string; sheetRow?: number }>
    }) => createDeliveryBatch({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-shipments'] })
    },
  })
}

export function useSimulateDeliveryShipments() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { shipmentIds: string[]; outcome: SimulationOutcome }) =>
      simulateDeliveryShipments({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-shipments'] })
    },
  })
}

export function useDeliveryCarrierConnection() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['delivery-carrier-connection', tenantId],
    queryFn: () => getDeliveryCarrierConnection(),
    staleTime: 15_000,
  })
}

function useInvalidateCarrierMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['delivery-carrier-connection'] }),
  })
}

export function useSaveYalidineConnection() {
  return useInvalidateCarrierMutation(
    (data: { accountLabel?: string; apiId: string; apiToken: string }) =>
      saveYalidineConnection({ data }),
  )
}

export function useTestYalidineConnection() {
  return useInvalidateCarrierMutation(() => testSavedYalidineConnection())
}

export function useDeleteYalidineConnection() {
  return useInvalidateCarrierMutation(() => deleteYalidineConnection())
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

export const callLogsQueryOptions = (tenantId: string) =>
  queryOptions({
    queryKey: ['call-logs', tenantId],
    queryFn: () => getCallLogs(),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })

export function useCallLogs() {
  const tenantId = useTenantId()
  return useQuery(callLogsQueryOptions(tenantId))
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

export const inventorySettingsQueryOptions = (tenantId: string) =>
  queryOptions({
    queryKey: ['inventory-settings', tenantId],
    queryFn: () => getInventorySettings(),
    staleTime: 30_000,
  })

export function useInventorySettings() {
  const tenantId = useTenantId()
  return useQuery(inventorySettingsQueryOptions(tenantId))
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
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export const storeConnectionsQueryOptions = (tenantId: string) =>
  queryOptions({
    queryKey: ['store-connections', tenantId],
    queryFn: () => getStoreConnections(),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  })

export function useStoreConnections() {
  const tenantId = useTenantId()
  return useQuery(storeConnectionsQueryOptions(tenantId))
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

export const googleSheetsOverviewQueryOptions = (tenantId: string) =>
  queryOptions({
    queryKey: ['google-sheets-overview', tenantId],
    queryFn: () => getGoogleSheetsOverview(),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  })

export function useGoogleSheetsOverview() {
  const tenantId = useTenantId()
  return useQuery(googleSheetsOverviewQueryOptions(tenantId))
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
