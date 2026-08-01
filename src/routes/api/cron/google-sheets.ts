import { createFileRoute } from '@tanstack/react-router'
import { syncActiveGoogleSheetsInBackground } from '~/server/google-sheets'

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

export const Route = createFileRoute('/api/cron/google-sheets')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorized(request)) {
          return Response.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
        }

        try {
          const result = await syncActiveGoogleSheetsInBackground()
          return Response.json(
            { ok: true, ...result },
            { headers: { 'Cache-Control': 'no-store' } },
          )
        } catch (error) {
          console.error('Background Google Sheets sync failed:', error)
          return Response.json(
            { ok: false, error: 'BACKGROUND_SYNC_FAILED' },
            { status: 500, headers: { 'Cache-Control': 'no-store' } },
          )
        }
      },
    },
  },
})
