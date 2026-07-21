import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { supabase } from '~/utils/supabase-client'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

export const Route = createFileRoute('/auth')({
  component: AuthPage,
})

function AuthPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      if (data.session) {
        toast.success('تم تسجيل الدخول بنجاح')
        navigate({ to: '/dashboard' })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطأ في تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-ink)] p-4 relative overflow-hidden">
      <div className="absolute inset-0 brand-glow" />
      <div className="absolute inset-0 brand-speedlines opacity-60" />

      <div className="relative w-full max-w-md">
        <motion.div
          className="flex justify-center mb-8"
          initial={{ opacity: 0, scale: 0.8, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <img
            src="/logo.png"
            alt="T-Flow"
            className="h-20 w-auto object-contain drop-shadow-[0_8px_24px_rgba(231,39,52,0.35)]"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Card className="w-full border-white/10 bg-card/95 backdrop-blur shadow-2xl overflow-hidden">
            <div className="h-[3px] bg-primary" />
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl font-bold text-foreground">تسجيل الدخول</CardTitle>
              <p className="text-muted-foreground text-sm">أدخل بياناتك للوصول إلى لوحة التحكم</p>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    dir="ltr"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'جاري الدخول...' : 'دخول'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.p
          className="text-center text-white/30 text-xs mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          T-Flow — إدارة الطلبات بسرعة الفهد
        </motion.p>
      </div>
    </div>
  )
}
