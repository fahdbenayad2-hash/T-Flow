import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Send,
  ShieldCheck,
  ShoppingBag,
  TestTube2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState, ErrorState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { useStoreConnections } from '~/lib/queries'

export const Route = createFileRoute('/_authenticated/integration-test/$id')({
  component: IntegrationTestPage,
})

interface TestOrderForm {
  orderId: string
  customerName: string
  phone: string
  wilaya: string
  baladiya: string
  address: string
  product: string
  price: string
  quantity: string
  deliveryType: string
  notes: string
}

interface WebhookResult {
  ok?: boolean
  test?: boolean
  duplicate?: boolean
  orderId?: string
  error?: string
  details?: string[]
}

const initialOrder = (): TestOrderForm => ({
  orderId: `TEST-${Date.now()}`,
  customerName: 'اختبار DOUDI',
  phone: '0550000001',
  wilaya: 'الجزائر',
  baladiya: 'باب الزوار',
  address: 'عنوان تجريبي',
  product: 'طلب تجريبي DOUDI',
  price: '3500',
  quantity: '1',
  deliveryType: 'home',
  notes: 'طلب تجريبي من متجر T-Flow',
})

function IntegrationTestPage() {
  const { id } = Route.useParams()
  const connectionsQuery = useStoreConnections()
  const [secret, setSecret] = useState('')
  const [form, setForm] = useState<TestOrderForm>(initialOrder)
  const [sendingMode, setSendingMode] = useState<'test' | 'create' | null>(null)
  const [result, setResult] = useState<WebhookResult | null>(null)

  const connection = useMemo(
    () => connectionsQuery.data?.connections.find((item) => item.id === id),
    [connectionsQuery.data, id],
  )

  const updateField = (field: keyof TestOrderForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const sendOrder = async (mode: 'test' | 'create') => {
    if (!connection) return
    if (!secret.trim()) {
      toast.error('أدخل المفتاح السري للاتصال')
      return
    }
    if (!form.customerName.trim() || !form.phone.trim() || !form.product.trim()) {
      toast.error('اسم العميل والهاتف والمنتج مطلوبة')
      return
    }

    setSendingMode(mode)
    setResult(null)
    try {
      const response = await fetch(connection.endpointPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TFlow-Secret': secret.trim(),
          ...(mode === 'test' ? { 'X-TFlow-Test': '1' } : {}),
        },
        body: JSON.stringify({
          order_id: form.orderId,
          customer_name: form.customerName,
          phone: form.phone,
          wilaya: form.wilaya,
          baladiya: form.baladiya,
          address: form.address,
          product: form.product,
          price: Number(form.price) || 0,
          quantity: Math.max(Number(form.quantity) || 1, 1),
          delivery_type: form.deliveryType,
          notes: form.notes,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as WebhookResult
      if (!response.ok || !payload.ok) {
        const message =
          payload.details?.join('، ') ||
          (payload.error === 'INVALID_SECRET'
            ? 'المفتاح السري غير صحيح'
            : payload.error || 'فشل إرسال الطلب')
        throw new Error(message)
      }

      setResult(payload)
      toast.success(
        mode === 'test'
          ? 'الاتصال والحقول يعملان بشكل صحيح'
          : payload.duplicate
            ? 'الطلب موجود مسبقًا ولم يتكرر'
            : 'تم إنشاء الطلب التجريبي بنجاح',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل إرسال الطلب')
    } finally {
      setSendingMode(null)
    }
  }

  if (connectionsQuery.isLoading) {
    return <div className="h-[420px] rounded-[16px] skeleton-shimmer" />
  }

  if (connectionsQuery.isError) {
    return (
      <ErrorState
        message={
          connectionsQuery.error instanceof Error ? connectionsQuery.error.message : undefined
        }
        onRetry={() => connectionsQuery.refetch()}
      />
    )
  }

  if (!connection) {
    return (
      <EmptyState
        title="الاتصال غير موجود"
        description="ربما تم حذف هذا الاتصال. ارجع إلى صفحة ربط المتاجر واختر اتصالًا آخر."
      />
    )
  }

  return (
    <RoleGuard roles={['admin']}>
      <div className="mx-auto max-w-5xl space-y-5">
        <section
          className="relative overflow-hidden rounded-[16px] p-5 md:p-6 text-white"
          style={{ background: 'linear-gradient(110deg, #0e1113 0%, #171a1e 60%, #361111 100%)' }}
        >
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-mono tracking-wider text-red-300 mb-2">
                <ShoppingBag className="h-4 w-4" />
                TEST STOREFRONT
              </div>
              <h2 className="text-[22px] font-black">متجر تجريبي — {connection.name}</h2>
              <p className="text-[12.5px] text-white/60 mt-2">
                جرّب الربط أولًا، ثم أنشئ طلبًا حقيقيًا يظهر في قائمة الطلبات.
              </p>
            </div>
            <Button variant="secondary" asChild>
              <Link to="/integrations">
                <ArrowRight className="h-4 w-4" />
                رجوع للاتصالات
              </Link>
            </Button>
          </div>
        </section>

        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="rounded-[12px] border border-emerald-500/25 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <ShieldCheck className="h-4 w-4" />
                المفتاح لا يُحفظ
              </div>
              <p className="text-[11.5px] text-muted-foreground mt-1">
                يُستخدم في هذه الصفحة فقط أثناء الإرسال، ولن يظهر في الرابط أو قاعدة البيانات.
              </p>
            </div>

            <label className="space-y-2 block">
              <span className="text-[12px] font-bold">المفتاح السري للاتصال</span>
              <Input
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="tfwh_..."
                dir="ltr"
                autoComplete="off"
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['orderId', 'رقم الطلب التجريبي'],
                ['customerName', 'اسم العميل'],
                ['phone', 'رقم الهاتف'],
                ['wilaya', 'الولاية'],
                ['baladiya', 'البلدية'],
                ['address', 'العنوان'],
                ['product', 'المنتج'],
                ['price', 'السعر'],
                ['quantity', 'الكمية'],
                ['deliveryType', 'نوع التوصيل'],
                ['notes', 'ملاحظات'],
              ].map(([field, label]) => (
                <label key={field} className="space-y-2 block">
                  <span className="text-[12px] font-semibold">{label}</span>
                  <Input
                    value={form[field as keyof TestOrderForm]}
                    onChange={(event) =>
                      updateField(field as keyof TestOrderForm, event.target.value)
                    }
                    dir={field === 'phone' || field === 'orderId' ? 'ltr' : undefined}
                    type={field === 'price' || field === 'quantity' ? 'number' : 'text'}
                  />
                </label>
              ))}
            </div>

            {result && (
              <div className="rounded-[12px] border border-emerald-500/25 bg-emerald-500/10 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">
                    {result.test
                      ? 'الاتصال ناجح — لم يتم إنشاء طلب'
                      : result.duplicate
                        ? 'الطلب موجود مسبقًا'
                        : 'تم إنشاء الطلب بنجاح'}
                  </p>
                  {result.orderId && (
                    <p className="font-mono text-[11px] text-muted-foreground mt-1" dir="ltr">
                      {result.orderId}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => sendOrder('test')}
                disabled={sendingMode !== null || !connection.isActive}
              >
                {sendingMode === 'test' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube2 className="h-4 w-4" />
                )}
                فحص بدون إنشاء طلب
              </Button>
              <Button
                onClick={() => sendOrder('create')}
                disabled={sendingMode !== null || !connection.isActive}
              >
                {sendingMode === 'create' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                إنشاء طلب تجريبي حقيقي
              </Button>
            </div>

            {!connection.isActive && (
              <p className="text-[12px] text-destructive text-center">
                هذا الاتصال متوقف. فعّله من صفحة ربط المتاجر قبل الاختبار.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  )
}
