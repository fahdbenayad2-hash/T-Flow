import { useMutation, useQuery } from '@tanstack/react-query'
import { Database, RefreshCw, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '~/components/ui/button'
import { previewOrderMigration, runOrderMigration } from '~/server/order-migration'
import { useTenantId } from '~/hooks/useTenantScope'

function CountCell({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-[12px] border border-[var(--color-border)] p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-black tabular-nums">
        {value === undefined ? '—' : value}
      </div>
    </div>
  )
}

export function OrderMigrationCard() {
  const tenantId = useTenantId()
  const preview = useQuery({
    queryKey: ['order-migration-preview', tenantId],
    queryFn: () => previewOrderMigration(),
    retry: false,
  })

  const migration = useMutation({
    mutationFn: () => runOrderMigration({ data: { confirm: true } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(`تمت مزامنة ${result.data.inserted + result.data.updated} طلب بنجاح`)
      await preview.refetch()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'فشل استيراد الطلبات')
    },
  })

  const data = preview.data
  const isReady = Boolean(data) && !data?.demo && data?.sheetOrderCount !== undefined

  return (
    <div className="dc-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[14.5px] font-extrabold">تخزين الطلبات الجديد</h3>
          </div>
          <p className="text-[12px] text-muted-foreground">
            استيراد آمن من Google Sheets إلى Supabase دون إيقاف المصدر الحالي
          </p>
        </div>
        {data && (
          <span
            className="inline-flex h-6 items-center rounded-full px-2.5 text-[10px] font-bold"
            style={{
              background: data.storageMode === 'supabase' ? '#22c55e' : '#f59e0b',
              color: '#fff',
            }}
          >
            {data.storageMode === 'supabase'
              ? 'Supabase أساسي'
              : data.storageMode === 'shadow'
                ? 'مزامنة تجريبية'
                : 'Sheets أساسي'}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <CountCell label="طلبات Google Sheets" value={data?.sheetOrderCount} />
        <CountCell label="طلبات Supabase" value={data?.supabaseOrderCount} />
      </div>

      {preview.isError && (
        <div className="mt-3 rounded-[11px] bg-red-500/10 px-3 py-2 text-[11.5px] text-red-600">
          تعذر قراءة جداول الترحيل. طبّق migration رقم 002 في Supabase أولاً.
        </div>
      )}

      {data?.lastRun && (
        <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          آخر استيراد: {new Date(data.lastRun.started_at).toLocaleString('ar-DZ')}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => preview.refetch()}
          disabled={preview.isFetching}
          className="h-9 rounded-[11px] text-[12px] font-bold"
        >
          <RefreshCw className={`h-4 w-4 ${preview.isFetching ? 'animate-spin' : ''}`} />
          فحص
        </Button>
        <Button
          size="sm"
          onClick={() => migration.mutate()}
          disabled={!isReady || migration.isPending}
          className="h-9 rounded-[11px] text-[12px] font-bold"
        >
          {migration.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
          استيراد إلى Supabase
        </Button>
      </div>

      <p className="mt-3 text-[10.5px] leading-5 text-muted-foreground">
        العملية قابلة للتكرار ولا تحذف طلبات Sheets. يبقى التحويل النهائي متوقفاً حتى ضبط
        ORDER_STORAGE_MODE يدوياً بعد التحقق.
      </p>
    </div>
  )
}
