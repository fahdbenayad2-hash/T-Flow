import { createFileRoute } from '@tanstack/react-router'
import { runScheduledMaintenance } from '~/server/maintenance'

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
          const result = await runScheduledMaintenance()
          return Response.json(
            { ok: true, ...result },
            { headers: { 'Cache-Control': 'no-store' } },
          )
        } catch (error) {
          console.error('Scheduled maintenance failed:', error)
          return Response.json(
            { ok: false, error: 'SCHEDULED_MAINTENANCE_FAILED' },
            { status: 500, headers: { 'Cache-Control': 'no-store' } },
          )
        }
      },
    },
  },
})
