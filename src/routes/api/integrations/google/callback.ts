import { createFileRoute } from '@tanstack/react-router'
import { completeGoogleOAuth } from '~/server/google-sheets'

function redirectToIntegrations(request: Request, result: string) {
  const url = new URL('/google-sheets', request.url)
  url.searchParams.set('google', result)
  // TanStack merges cookies set during the OAuth callback into this response.
  // Response.redirect() creates immutable headers in Node, which makes that
  // merge fail with `TypeError: immutable`.
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString() },
  })
}

export const Route = createFileRoute('/api/integrations/google/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const oauthError = url.searchParams.get('error')
        if (oauthError) return redirectToIntegrations(request, 'cancelled')
        if (!code || !state) return redirectToIntegrations(request, 'invalid')

        try {
          await completeGoogleOAuth(code, state)
          return redirectToIntegrations(request, 'connected')
        } catch (error) {
          console.error('Google OAuth callback failed:', error)
          return redirectToIntegrations(request, 'failed')
        }
      },
    },
  },
})
