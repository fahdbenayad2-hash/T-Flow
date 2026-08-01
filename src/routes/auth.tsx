import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { supabase } from '~/utils/supabase-client'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { setAuthCookie } from '~/utils/auth-cookie'
import { LogIn, Mail, Store, UserPlus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

export const Route = createFileRoute('/auth')({
  component: AuthPage,
})

function AuthPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [fullName, setFullName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [registrationMessage, setRegistrationMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  // If a client-side session still exists (e.g. the SSR cookie expired but the
  // refresh token is valid), restore the cookie and go straight to the dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        queryClient.clear()
        setAuthCookie(data.session.access_token, data.session.expires_in)
        navigate({ to: '/dashboard' })
      }
    })
  }, [navigate, queryClient])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()

      if (mode === 'register') {
        if (fullName.trim().length < 2) throw new Error('اكتب اسمك الكامل')
        if (storeName.trim().length < 2) throw new Error('اكتب اسم المتجر')
        if (password.length < 8) throw new Error('كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل')
        if (password !== confirmPassword) throw new Error('كلمتا المرور غير متطابقتين')

        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              full_name: fullName.trim(),
              store_name: storeName.trim(),
              registration_type: 'seller',
            },
          },
        })

        if (error) throw error

        if (data.session) {
          queryClient.clear()
          setAuthCookie(data.session.access_token, data.session.expires_in)
          toast.success('تم إنشاء حسابك ومتجرك بنجاح')
          navigate({ to: '/dashboard' })
          return
        }

        setRegistrationMessage(
          `أرسلنا رابط تأكيد إلى ${normalizedEmail}. افتح الرسالة ثم ارجع لتسجيل الدخول.`,
        )
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        toast.success('تم إنشاء الحساب، راجع بريدك الإلكتروني')
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) throw error
      if (!data.session) throw new Error('تعذر بدء جلسة الدخول')

      queryClient.clear()
      setAuthCookie(data.session.access_token, data.session.expires_in)
      toast.success('تم تسجيل الدخول بنجاح')
      navigate({ to: '/dashboard' })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''

      if (/invalid login credentials/i.test(message)) {
        toast.error('بيانات الدخول غير صحيحة، أو الحساب ما زال ينتظر تفعيل البريد')
      } else if (/email not confirmed/i.test(message)) {
        toast.error('فعّل حسابك من الرسالة، أو اضغط على إعادة إرسال رابط التفعيل')
      } else if (/user already registered/i.test(message)) {
        toast.error('هذا البريد مسجل من قبل. ادخل إلى حسابك أو أعد إرسال رابط التفعيل')
      } else if (/rate limit/i.test(message)) {
        toast.error('تم طلب رسائل كثيرة. انتظر دقيقة ثم حاول مجدداً')
      } else {
        toast.error(message || (mode === 'register' ? 'تعذر إنشاء الحساب' : 'خطأ في تسجيل الدخول'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      toast.error('اكتب بريدك الإلكتروني أولاً')
      return
    }

    setResendLoading(true)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      })

      if (error) throw error

      setRegistrationMessage(
        `أعدنا إرسال رابط التفعيل إلى ${normalizedEmail}. راجع البريد غير المرغوب فيه أيضاً.`,
      )
      toast.success('تمت إعادة إرسال رابط التفعيل')
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      toast.error(
        /rate limit/i.test(message)
          ? 'تم طلب رسائل كثيرة. انتظر دقيقة ثم حاول مجدداً'
          : message || 'تعذر إرسال رابط التفعيل',
      )
    } finally {
      setResendLoading(false)
    }
  }

  const changeMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode)
    setRegistrationMessage('')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-ink)] p-4 relative overflow-hidden">
      <div className="absolute inset-0 brand-glow" />
      <div className="absolute inset-0 brand-speedlines opacity-60" />

      <div className="relative w-full max-w-lg">
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
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {mode === 'login' ? <LogIn className="h-5 w-5" /> : <Store className="h-5 w-5" />}
              </div>
              <CardTitle className="text-xl font-bold text-foreground">
                {mode === 'login' ? 'تسجيل الدخول' : 'أنشئ حساب بائع'}
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                {mode === 'login'
                  ? 'أدخل بياناتك للوصول إلى لوحة التحكم'
                  : 'حساب مستقل ومتجر خاص لإدارة طلباتك وفريقك'}
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="mb-5 grid grid-cols-2 rounded-xl bg-muted/70 p-1" dir="rtl">
                <button
                  type="button"
                  onClick={() => changeMode('login')}
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                    mode === 'login'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  دخول
                </button>
                <button
                  type="button"
                  onClick={() => changeMode('register')}
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                    mode === 'register'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  حساب جديد
                </button>
              </div>

              {registrationMessage && (
                <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-sm leading-6 text-emerald-600">
                  {registrationMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="full-name">الاسم الكامل</Label>
                      <Input
                        id="full-name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="فهد بن عياد"
                        autoComplete="name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="store-name">اسم المتجر</Label>
                      <Input
                        id="store-name"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="متجر فهد"
                        autoComplete="organization"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seller@example.com"
                    autoComplete="email"
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
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    minLength={mode === 'register' ? 8 : undefined}
                    required
                    dir="ltr"
                  />
                </div>

                {mode === 'register' && (
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      dir="ltr"
                    />
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {mode === 'register' ? (
                    <UserPlus className="ml-2 h-4 w-4" />
                  ) : (
                    <LogIn className="ml-2 h-4 w-4" />
                  )}
                  {loading
                    ? mode === 'register'
                      ? 'جاري إنشاء الحساب...'
                      : 'جاري الدخول...'
                    : mode === 'register'
                      ? 'إنشاء حسابي ومتجري'
                      : 'دخول'}
                </Button>

                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={resendLoading || !email.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4" />
                    {resendLoading ? 'جاري إعادة الإرسال...' : 'لم تصلك رسالة التفعيل؟ أعد إرسالها'}
                  </button>
                )}
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
