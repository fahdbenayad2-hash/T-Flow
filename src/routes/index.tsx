import { createFileRoute, redirect } from '@tanstack/react-router'
import { LandingPage } from '~/components/landing/landing-page'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    if (typeof window !== 'undefined') {
      const { supabase } = await import('~/utils/supabase-client')
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        throw redirect({ to: '/dashboard' })
      }
    }
  },
  head: () => ({
    meta: [
      {
        name: 'description',
        content:
          'T-Flow — منصة عربية لإدارة طلبات الدفع عند الاستلام. لوحة تحكم، طلبات، عملاء، مركز اتصال، توصيل، تقارير، وصلاحيات حسب الدور. مصممة لبائعي الجزائر.',
      },
    ],
  }),
  component: LandingPage,
})
