import { createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileSpreadsheet,
  HardDriveDownload,
  RefreshCw,
  ShieldCheck,
  Truck,
  Webhook,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ErrorState } from '~/components/empty-state'
import { RoleGuard } from '~/components/role-guard'
import { Button } from '~/components/ui/button'
import {
  useInventorySettings,
  useOrders,
  useRecordBackupExport,
  useSystemHealthOverview,
} from '~/lib/queries'
import type { HealthCheck, HealthStatus } from '~/lib/system-health'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/system-health')({
  component: SystemHealthPage,
})

const CHECK_ICONS = {
  database: Database,
  google_sheets: FileSpreadsheet,
  storefront: Webhook,
  writeback: RefreshCw,
  delivery: Truck,
}

const STATUS_STYLES: Record<HealthStatus, { label: string; className: string }> = {
  healthy: { label: 'سليم', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  warning: { label: 'تنبيه', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  critical: { label: 'حرج', className: 'bg-destructive/10 text-destructive border-destructive/20' },
}

function formatTimestamp(value: string | null) {
  if (!value) return 'لم تُنشأ نسخة بعد'
  return new Intl.DateTimeFormat('ar-DZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Algiers',
  }).format(new Date(value))
}

function HealthCard({ check }: { check: HealthCheck }) {
  const Icon = CHECK_ICONS[check.id]
  const style = STATUS_STYLES[check.status]
  return (
    <article className="dc-card p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl border',
            style.className,
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span
          className={cn('rounded-full border px-2.5 py-1 text-[10px] font-bold', style.className)}
        >
          {style.label}
        </span>
      </div>
      <h3 className="text-[14px] font-extrabold">{check.label}</h3>
      <p className="mt-1.5 min-h-10 text-[11.5px] leading-5 text-muted-foreground">
        {check.message}
      </p>
      <div className="mt-4 border-t border-border/70 pt-3 font-mono text-[10.5px] text-muted-foreground">
        {check.metric}
      </div>
    </article>
  )
}

function HealthSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-44 rounded-2xl skeleton-shimmer" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="h-52 rounded-2xl skeleton-shimmer" />
        ))}
      </div>
      <div className="h-72 rounded-2xl skeleton-shimmer" />
    </div>
  )
}

function SystemHealthPage() {
  const healthQuery = useSystemHealthOverview()
  const ordersQuery = useOrders()
  const inventoryQuery = useInventorySettings()
  const backupMutation = useRecordBackupExport()

  if (healthQuery.isLoading || ordersQuery.isLoading || inventoryQuery.isLoading) {
    return <HealthSkeleton />
  }

  if (healthQuery.isError || ordersQuery.isError || inventoryQuery.isError) {
    const error = healthQuery.error || ordersQuery.error || inventoryQuery.error
    return (
      <ErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => {
          healthQuery.refetch()
          ordersQuery.refetch()
          inventoryQuery.refetch()
        }}
      />
    )
  }

  const overview = healthQuery.data!
  const statusStyle = STATUS_STYLES[overview.health.status]

  const downloadBackup = () => {
    const exportedAt = new Date().toISOString()
    const payload = {
      schemaVersion: 1,
      exportedAt,
      store: overview.store,
      health: {
        score: overview.health.score,
        status: overview.health.status,
      },
      orders: ordersQuery.data?.orders || [],
      inventorySettings: inventoryQuery.data || [],
    }
    const json = JSON.stringify(payload, null, 2)
    const fileName = `tflow-backup-${exportedAt.slice(0, 10)}.json`
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)

    backupMutation.mutate(
      { orderCount: payload.orders.length, fileName, byteSize: blob.size },
      {
        onSuccess: () => toast.success(`تم تنزيل نسخة تحتوي على ${payload.orders.length} طلب`),
        onError: () => toast.error('تم تنزيل النسخة، لكن تعذر تسجيل العملية في السجل'),
      },
    )
  }

  return (
    <RoleGuard roles={['admin']}>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
        <section className="relative overflow-hidden rounded-[18px] border border-border bg-card p-6">
          <div className="absolute -left-16 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-background">
                <span className="font-mono text-[24px] font-black">{overview.health.score}</span>
                <span className="absolute bottom-2 text-[8px] text-muted-foreground">/ 100</span>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-primary">
                    SYSTEM HEALTH
                  </span>
                </div>
                <h2 className="text-[23px] font-black">صحة {overview.store.name}</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  آخر فحص: {formatTimestamp(overview.generatedAt)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-xl border px-3 py-2 text-[11px] font-bold',
                  statusStyle.className,
                )}
              >
                {statusStyle.label} · {overview.health.criticalCount} حرج ·{' '}
                {overview.health.warningCount} تنبيه
              </span>
              <Button
                variant="outline"
                onClick={() => healthQuery.refetch()}
                disabled={healthQuery.isFetching}
                className="rounded-xl"
              >
                <RefreshCw className={cn('h-4 w-4', healthQuery.isFetching && 'animate-spin')} />
                فحص الآن
              </Button>
              <Button
                onClick={downloadBackup}
                disabled={backupMutation.isPending}
                className="rounded-xl"
              >
                <HardDriveDownload className="h-4 w-4" />
                نسخة احتياطية
              </Button>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-[15px] font-extrabold">فحوصات الخدمات</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {overview.health.checks.map((check) => (
              <HealthCard key={check.id} check={check} />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_0.8fr]">
          <div className="dc-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-[14px] font-extrabold">آخر المشاكل التشغيلية</h3>
                <p className="mt-1 text-[10.5px] text-muted-foreground">
                  أخطاء الربط والمزامنة والتوصيل
                </p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[10px]">
                {overview.incidents.length}
              </span>
            </div>
            {overview.incidents.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center px-5 text-center">
                <CheckCircle2 className="mb-3 h-9 w-9 text-emerald-500" />
                <h4 className="text-[13px] font-bold">لا توجد مشاكل حديثة</h4>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  لم تسجّل الخدمات أخطاء تحتاج تدخلك خلال آخر 24 ساعة.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {overview.incidents.map((incident) => (
                  <div key={incident.id} className="flex gap-3 px-5 py-4">
                    <span
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        incident.severity === 'critical'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-amber-500/10 text-amber-500',
                      )}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[12px] font-bold">{incident.source}</p>
                        <span className="font-mono text-[9.5px] text-muted-foreground">
                          {formatTimestamp(incident.occurredAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11.5px] text-muted-foreground">{incident.message}</p>
                      {incident.details && (
                        <p className="mt-1 truncate font-mono text-[9.5px] text-muted-foreground/70">
                          {incident.details}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="dc-card p-5">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HardDriveDownload className="h-5 w-5" />
            </div>
            <h3 className="text-[15px] font-extrabold">النسخ الاحتياطي</h3>
            <p className="mt-2 text-[11.5px] leading-5 text-muted-foreground">
              ملف JSON يحتوي على الطلبات الحالية وإعدادات المخزون وهو معزول لهذا المتجر فقط. تحفظ
              المنصة أيضاً نسخة تلقائية يومية في قاعدة البيانات وتحتفظ بآخر 30 يوماً.
            </p>
            <div className="my-5 rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                آخر نسخة
              </div>
              <p className="mt-1.5 text-[11.5px] font-bold">
                {formatTimestamp(overview.lastBackupAt)}
              </p>
            </div>
            <Button
              onClick={downloadBackup}
              variant="outline"
              disabled={backupMutation.isPending}
              className="w-full rounded-xl"
            >
              <HardDriveDownload className="h-4 w-4" />
              تنزيل نسخة الآن
            </Button>
          </aside>
        </section>
      </div>
    </RoleGuard>
  )
}
