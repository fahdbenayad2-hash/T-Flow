import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRole } from '~/hooks/useRole'
import { useGoogleSheetsOverview } from '~/lib/queries'
import { syncGoogleSheetConnection } from '~/server/google-sheets'

const AUTO_SYNC_INTERVAL_MS = 60_000
const MIN_SYNC_AGE_MS = 45_000

function GoogleSheetsAutoSyncWorker() {
  const overview = useGoogleSheetsOverview()
  const queryClient = useQueryClient()
  const syncing = useRef(false)

  const syncActiveConnections = useCallback(async () => {
    if (syncing.current || document.visibilityState === 'hidden' || !navigator.onLine) return

    const now = Date.now()
    const dueConnections = (overview.data?.connections || []).filter((connection) => {
      if (!connection.isActive) return false
      if (!connection.lastSyncedAt) return true
      const lastSync = Date.parse(connection.lastSyncedAt)
      return !Number.isFinite(lastSync) || now - lastSync >= MIN_SYNC_AGE_MS
    })
    if (!dueConnections.length) return

    syncing.current = true
    let synced = false
    try {
      for (const connection of dueConnections) {
        try {
          await syncGoogleSheetConnection({ data: { id: connection.id } })
          synced = true
        } catch (error) {
          console.warn('Automatic Google Sheets sync failed:', error)
        }
      }
    } finally {
      syncing.current = false
    }

    if (synced) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['google-sheets-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ])
    }
  }, [overview.data?.connections, queryClient])

  useEffect(() => {
    if (!overview.data?.connections.some((connection) => connection.isActive)) return

    const initialSync = window.setTimeout(() => void syncActiveConnections(), 3_000)
    const interval = window.setInterval(() => void syncActiveConnections(), AUTO_SYNC_INTERVAL_MS)
    const handleFocus = () => void syncActiveConnections()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void syncActiveConnections()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearTimeout(initialSync)
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [overview.data?.connections, syncActiveConnections])

  return null
}

export function GoogleSheetsAutoSync() {
  const { isAdmin, isLoading } = useRole()
  if (isLoading || !isAdmin) return null
  return <GoogleSheetsAutoSyncWorker />
}
