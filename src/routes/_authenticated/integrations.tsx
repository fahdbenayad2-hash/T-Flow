import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  CircleOff,
  Copy,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcwKey,
  Send,
  ShieldCheck,
  Store,
  Unplug,
  Webhook,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { EmptyState, ErrorState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { STOREFRONT_SAMPLE_ORDER } from '~/lib/storefront-order'
import {
  useCreateStoreConnection,
  useRotateStoreConnectionSecret,
  useSetStoreConnectionActive,
  useStoreConnections,
} from '~/lib/queries'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/integrations')({
  component: IntegrationsPage,
})

interface RevealedSecret {
  connectionId: string
  connectionName: string
  endpointPath: string
  secret: string
}

const EVENT_META = {
  accepted: {
    label: 'مقبول',
    className: 'bg-emerald-500/10 text-emerald-500',
    icon: CheckCircle2,
  },
  duplicate: {
    label: 'مكرر',
    className: 'bg-amber-500/10 text-amber-500',
    icon: RefreshCw,
  },
  rejected: {
    label: 'مرفوض',
    className: 'bg-red-500/10 text-red-500',
    icon: XCircle,
  },
} as const

function formatConnectionDate(value: string | null | undefined) {
  if (!value) return 'لم يستقبل طلبات بعد'
  return new Intl.DateTimeFormat('ar-DZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function IntegrationsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="h-[145px] rounded-[16px] skeleton-shimmer" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="h-[100px] rounded-[15px] skeleton-shimmer" />
        ))}
      </div>
      <div className="h-[260px] rounded-[15px] skeleton-shimmer" />
    </div>
  )
}

function IntegrationsPage() {
  const connectionsQuery = useStoreConnections()
  const createConnection = useCreateStoreConnection()
  const rotateSecret = useRotateStoreConnectionSecret()
  const setActive = useSetStoreConnectionActive()
  const [createOpen, setCreateOpen] = useState(false)
  const [connectionName, setConnectionName] = useState('')
  const [revealedSecret, setRevealedSecret] = useState<RevealedSecret | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const connections = useMemo(
    () => connectionsQuery.data?.connections ?? [],
    [connectionsQuery.data],
  )
  const events = useMemo(() => connectionsQuery.data?.events ?? [], [connectionsQuery.data])
  const stats = useMemo(
    () => ({
      total: connections.length,
      active: connections.filter((connection) => connection.isActive).length,
      received: connections.reduce((sum, connection) => sum + connection.receivedCount, 0),
      errors: connections.reduce((sum, connection) => sum + connection.errorCount, 0),
    }),
    [connections],
  )

  const copyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(message)
    } catch {
      toast.error('تعذر النسخ، حدّد النص وانسخه يدويًا')
    }
  }

  const handleCreate = async () => {
    if (!connectionName.trim()) {
      toast.error('أدخل اسم الموقع')
      return
    }
    try {
      const result = await createConnection.mutateAsync(connectionName)
      setRevealedSecret({
        connectionId: result.connection.id,
        connectionName: result.connection.name,
        endpointPath: result.connection.endpointPath,
        secret: result.secret,
      })
      setConnectionName('')
      setCreateOpen(false)
      toast.success('تم إنشاء رابط الموقع')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر إنشاء الاتصال')
    }
  }

  const handleRotate = async (connection: (typeof connections)[number]) => {
    try {
      const result = await rotateSecret.mutateAsync(connection.id)
      setRevealedSecret({
        connectionId: connection.id,
        connectionName: connection.name,
        endpointPath: connection.endpointPath,
        secret: result.secret,
      })
      toast.success('تم إنشاء مفتاح سري جديد')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تغيير المفتاح')
    }
  }

  const handleToggle = async (connection: (typeof connections)[number]) => {
    try {
      await setActive.mutateAsync({
        id: connection.id,
        isActive: !connection.isActive,
      })
      toast.success(connection.isActive ? 'تم إيقاف الاتصال' : 'تم تفعيل الاتصال')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تغيير حالة الاتصال')
    }
  }

  const handleTest = async () => {
    if (!revealedSecret) return
    setIsTesting(true)
    try {
      const response = await fetch(revealedSecret.endpointPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TFlow-Secret': revealedSecret.secret,
          'X-TFlow-Test': '1',
        },
        body: JSON.stringify(STOREFRONT_SAMPLE_ORDER),
      })
      const result = (await response.json()) as { ok?: boolean; details?: string[] }
      if (!response.ok || !result.ok) {
        throw new Error(result.details?.join('، ') || 'فشل اختبار الاتصال')
      }
      toast.success('الاتصال ناجح والحقول مقروءة بشكل صحيح')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل اختبار الاتصال')
    } finally {
      setIsTesting(false)
    }
  }

  if (connectionsQuery.isLoading) return <IntegrationsSkeleton />
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

  const sampleJson = JSON.stringify(STOREFRONT_SAMPLE_ORDER, null, 2)

  return (
    <RoleGuard roles={['admin']}>
      <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
        <section
          className="relative overflow-hidden rounded-[16px] p-5 md:p-6 text-white"
          style={{ background: 'linear-gradient(110deg, #0e1113 0%, #171a1e 60%, #361111 100%)' }}
        >
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 15% 20%, rgba(227,30,36,.75), transparent 28%), repeating-linear-gradient(-20deg, transparent 0 34px, rgba(255,255,255,.05) 35px 36px)',
            }}
          />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 text-[11px] font-mono tracking-wider text-red-300 mb-2">
                <Webhook className="h-4 w-4" />
                STOREFRONT CONNECT
              </div>
              <h2 className="text-[22px] md:text-[26px] font-black">
                اربط أي موقع طلبات بـ T‑Flow
              </h2>
              <p className="text-[12.5px] md:text-[13px] text-white/60 mt-2 leading-6">
                استقبل الطلبات فورًا عبر رابط آمن، مع منع التكرار وسجل واضح لكل عملية.
              </p>
            </div>
            <Button
              onClick={() => setCreateOpen(true)}
              className="h-11 px-5 bg-red-600 hover:bg-red-500 text-white border-0 shrink-0"
            >
              <Plus className="h-4 w-4" />
              ربط موقع جديد
            </Button>
          </div>
        </section>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: 'كل الاتصالات', value: stats.total, icon: Link2, color: '#e31e24' },
            { label: 'اتصالات نشطة', value: stats.active, icon: Activity, color: '#22c55e' },
            { label: 'طلبات مستلمة', value: stats.received, icon: Send, color: '#3b82f6' },
            { label: 'طلبات مرفوضة', value: stats.errors, icon: CircleOff, color: '#f97316' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <article key={item.label} className="dc-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11.5px] text-muted-foreground">{item.label}</p>
                    <p className="font-mono text-[25px] font-bold mt-1">{item.value}</p>
                  </div>
                  <div
                    className="h-10 w-10 rounded-[11px] flex items-center justify-center"
                    style={{ color: item.color, background: `${item.color}18` }}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <section className="dc-card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-[14.5px] font-extrabold">المواقع المرتبطة</h3>
              <p className="text-[11.5px] text-muted-foreground mt-1">
                كل موقع يحصل على رابط ومفتاح سري مستقل
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => connectionsQuery.refetch()}>
              <RefreshCw className={cn('h-4 w-4', connectionsQuery.isFetching && 'animate-spin')} />
              تحديث
            </Button>
          </div>

          {connections.length === 0 ? (
            <EmptyState
              icon={<Unplug className="h-8 w-8 text-muted-foreground" />}
              title="لم يتم ربط أي موقع بعد"
              description="أنشئ أول رابط لاستقبال الطلبات مباشرة"
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  ربط أول موقع
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {connections.map((connection) => {
                const endpoint = connection.endpointPath
                return (
                  <article
                    key={connection.id}
                    className="rounded-[14px] border border-border bg-background/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-[11px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Store className="h-[18px] w-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-[13.5px] font-extrabold truncate">
                            {connection.name}
                          </h4>
                          <p className="text-[10.5px] text-muted-foreground mt-0.5">
                            آخر طلب: {formatConnectionDate(connection.lastReceivedAt)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold shrink-0',
                          connection.isActive
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            connection.isActive ? 'bg-emerald-500' : 'bg-muted-foreground',
                          )}
                        />
                        {connection.isActive ? 'نشط' : 'متوقف'}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <code
                        className="flex-1 min-w-0 h-9 px-3 rounded-[9px] bg-muted flex items-center font-mono text-[10.5px] truncate"
                        dir="ltr"
                      >
                        {endpoint}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          copyText(`${window.location.origin}${endpoint}`, 'تم نسخ رابط الاتصال')
                        }
                        aria-label={`نسخ رابط ${connection.name}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="rounded-[9px] bg-muted/60 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">مستلمة</p>
                        <p className="font-mono text-[13px] font-bold text-emerald-500 mt-0.5">
                          {connection.receivedCount}
                        </p>
                      </div>
                      <div className="rounded-[9px] bg-muted/60 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">مرفوضة</p>
                        <p className="font-mono text-[13px] font-bold text-orange-500 mt-0.5">
                          {connection.errorCount}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-divider">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRotate(connection)}
                        disabled={rotateSecret.isPending}
                      >
                        <RotateCcwKey className="h-4 w-4" />
                        مفتاح جديد
                      </Button>
                      <Button
                        variant={connection.isActive ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => handleToggle(connection)}
                        disabled={setActive.isPending}
                      >
                        {connection.isActive ? (
                          <CircleOff className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        {connection.isActive ? 'إيقاف' : 'تفعيل'}
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-4">
          <section className="dc-card p-5 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-[14.5px] font-extrabold">آخر عمليات الاستقبال</h3>
            </div>
            <p className="text-[11.5px] text-muted-foreground mb-4">نتيجة كل طلب وصل من المواقع</p>
            {events.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-10">
                لا توجد عمليات استقبال بعد
              </p>
            ) : (
              <div className="flex flex-col">
                {events.slice(0, 12).map((event) => {
                  const meta =
                    EVENT_META[event.status as keyof typeof EVENT_META] ?? EVENT_META.rejected
                  const Icon = meta.icon
                  const summary = (event.request_summary || {}) as {
                    customerName?: string
                    product?: string
                  }
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 py-3 border-b border-divider last:border-0"
                    >
                      <div
                        className={cn(
                          'h-8 w-8 rounded-[9px] flex items-center justify-center shrink-0',
                          meta.className,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-semibold truncate">
                          {summary.customerName || event.external_order_id || 'طلب غير مكتمل'}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">
                          {summary.product || event.error_message || '—'}
                        </p>
                      </div>
                      <div className="text-left shrink-0">
                        <span
                          className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-[9.5px] font-bold',
                            meta.className,
                          )}
                        >
                          {meta.label}
                        </span>
                        <p className="font-mono text-[9.5px] text-muted-foreground mt-1">
                          {formatConnectionDate(event.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="dc-card p-5 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="text-[14.5px] font-extrabold">صيغة الطلب المدعومة</h3>
            </div>
            <p className="text-[11.5px] text-muted-foreground mb-4">
              أرسل JSON إلى الرابط مع المفتاح في X-TFlow-Secret
            </p>
            <div className="relative">
              <pre
                className="rounded-[12px] bg-[#0d1117] text-gray-300 p-4 text-[10.5px] leading-5 overflow-auto max-h-[280px]"
                dir="ltr"
              >
                {sampleJson}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 left-2 h-7 text-[10px]"
                onClick={() => copyText(sampleJson, 'تم نسخ نموذج الطلب')}
              >
                <Copy className="h-3.5 w-3.5" />
                نسخ
              </Button>
            </div>
          </section>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>ربط موقع طلبات جديد</DialogTitle>
              <DialogDescription>
                سمِّ الاتصال باسم واضح مثل «متجر الملابس» أو «Landing Page المنتج».
              </DialogDescription>
            </DialogHeader>
            <label className="space-y-2">
              <span className="text-[12px] font-semibold">اسم الموقع</span>
              <Input
                value={connectionName}
                onChange={(event) => setConnectionName(event.target.value)}
                placeholder="مثال: متجر T‑Flow"
                maxLength={80}
                autoFocus
              />
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleCreate} disabled={createConnection.isPending}>
                {createConnection.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Webhook className="h-4 w-4" />
                )}
                إنشاء الرابط
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(revealedSecret)}
          onOpenChange={(open) => {
            if (!open) setRevealedSecret(null)
          }}
        >
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                بيانات ربط {revealedSecret?.connectionName}
              </DialogTitle>
              <DialogDescription>
                انسخ المفتاح الآن؛ لن يظهر مرة أخرى حفاظًا على أمان متجرك.
              </DialogDescription>
            </DialogHeader>

            {revealedSecret && (
              <div className="space-y-4">
                <div>
                  <p className="text-[11.5px] font-semibold mb-1.5">رابط الاستقبال</p>
                  <div className="flex gap-2">
                    <Input
                      value={revealedSecret.endpointPath}
                      readOnly
                      dir="ltr"
                      className="font-mono text-[11px]"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        copyText(
                          `${window.location.origin}${revealedSecret.endpointPath}`,
                          'تم نسخ رابط الاستقبال',
                        )
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-[11.5px] font-semibold mb-1.5">المفتاح السري</p>
                  <div className="flex gap-2">
                    <Input
                      value={revealedSecret.secret}
                      readOnly
                      dir="ltr"
                      className="font-mono text-[11px]"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyText(revealedSecret.secret, 'تم نسخ المفتاح السري')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-[11px] border border-amber-500/25 bg-amber-500/10 p-3 text-[11.5px] text-amber-600 dark:text-amber-400 leading-5">
                  ضع المفتاح في ترويسة <b dir="ltr">X-TFlow-Secret</b>. إذا فقدته، أنشئ مفتاحًا
                  جديدًا من بطاقة الاتصال.
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setRevealedSecret(null)}>
                إغلاق
              </Button>
              <Button onClick={handleTest} disabled={isTesting}>
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                اختبار الاتصال
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  )
}
