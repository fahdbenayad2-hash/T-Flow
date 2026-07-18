import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '~/utils/supabase-client'
import { LandingPage } from '~/components/landing/landing-page'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        throw redirect({ to: '/dashboard' })
      }
    }
  },
  head: () => ({
    meta: [
      {
        name: 'description',
        content: 'T-Flow — منصة عربية لإدارة طلبات الدفع عند الاستلام. لوحة تحكم، طلبات، عملاء، مركز اتصال، توصيل، تقارير، وصلاحيات حسب الدور. مصممة لبائعي الجزائر.',
      },
    ],
  }),
  component: LandingPage,
})
