import { useState } from 'react'
import { CheckCircle2, Eye, EyeOff, KeyRound, RefreshCw, Save, Trash2, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useDeleteYalidineConnection,
  useDeliveryCarrierConnection,
  useSaveYalidineConnection,
  useTestYalidineConnection,
} from '~/lib/queries'
import { Button } from './ui/button'
import { Input } from './ui/input'

function statusLabel(status?: 'untested' | 'connected' | 'error') {
  if (status === 'connected') return 'متصل'
  if (status === 'error') return 'فشل الاتصال'
  return 'بانتظار الاختبار'
}

function statusColor(status?: 'untested' | 'connected' | 'error') {
  if (status === 'connected') return '#22c55e'
  if (status === 'error') return '#ef4444'
  return '#f59e0b'
}

export function DeliveryCarrierSettings() {
  const connectionQuery = useDeliveryCarrierConnection()
  const saveConnection = useSaveYalidineConnection()
  const testConnection = useTestYalidineConnection()
  const deleteConnection = useDeleteYalidineConnection()
  const [accountLabel, setAccountLabel] = useState('حساب Yalidine')
  const [apiId, setApiId] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [showToken, setShowToken] = useState(false)

  const connection = connectionQuery.data

  const handleSave = async () => {
    try {
      await saveConnection.mutateAsync({ accountLabel, apiId, apiToken })
      setApiId('')
      setApiToken('')
      toast.success('تم حفظ بيانات Yalidine بشكل مشفر')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ الاتصال')
    }
  }

  const handleTest = async () => {
    try {
      await testConnection.mutateAsync(undefined)
      toast.success('اتصال Yalidine يعمل بنجاح')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل اختبار الاتصال')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('حذف اتصال Yalidine والمفتاح المحفوظ؟')) return
    try {
      await deleteConnection.mutateAsync(undefined)
      setApiId('')
      setApiToken('')
      toast.success('تم حذف اتصال Yalidine')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حذف الاتصال')
    }
  }

  return (
    <div className="dc-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="h-4 w-4 text-red-500" />
            <h3 className="text-[14.5px] font-extrabold">شركة التوصيل</h3>
          </div>
          <p className="text-[12px] text-muted-foreground">
            اربط حساب Yalidine لإرسال الطلبات واستقبال أرقام التتبع
          </p>
        </div>
        {connection && (
          <span
            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-bold text-white"
            style={{ background: statusColor(connection.status) }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {statusLabel(connection.status)}
          </span>
        )}
      </div>

      {connection && (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[12.5px] font-bold">{connection.accountLabel}</p>
              <p className="text-[11px] text-muted-foreground font-mono" dir="ltr">
                API ID: {connection.apiIdMasked}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-[9px] text-[11px] font-bold"
                onClick={handleTest}
                disabled={testConnection.isPending}
              >
                {testConnection.isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                اختبار
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-[9px] text-[11px] font-bold text-destructive"
                onClick={handleDelete}
                disabled={deleteConnection.isPending}
                aria-label="حذف اتصال Yalidine"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {connection.lastTestedAt && (
            <p className="mt-2 text-[10.5px] text-muted-foreground">
              آخر اختبار: {new Date(connection.lastTestedAt).toLocaleString('ar-DZ')}
            </p>
          )}
          {connection.lastError && (
            <p className="mt-2 text-[10.5px] text-red-500">{connection.lastError}</p>
          )}
        </div>
      )}

      <div className="grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-[11.5px] font-bold">اسم الحساب</span>
          <Input
            value={accountLabel}
            onChange={(event) => setAccountLabel(event.target.value)}
            placeholder="مثال: حساب المتجر الرئيسي"
            className="h-10 rounded-[11px]"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11.5px] font-bold">API ID</span>
          <Input
            value={apiId}
            onChange={(event) => setApiId(event.target.value)}
            placeholder={connection ? 'أدخل API ID جديداً لتغيير الاتصال' : 'من حساب Yalidine'}
            className="h-10 rounded-[11px] font-mono"
            dir="ltr"
            autoComplete="off"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11.5px] font-bold">API Token</span>
          <div className="relative">
            <Input
              type={showToken ? 'text' : 'password'}
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              placeholder={
                connection ? 'أدخل Token جديداً لتغيير الاتصال' : 'لا تستعمل كلمة مرور الحساب'
              }
              className="h-10 rounded-[11px] font-mono pl-10"
              dir="ltr"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowToken((value) => !value)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={showToken ? 'إخفاء API Token' : 'إظهار API Token'}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" />
            الرمز يُشفّر في الخادم ولا يظهر مرة أخرى
          </div>
          <Button
            onClick={handleSave}
            disabled={saveConnection.isPending || !apiId.trim() || !apiToken.trim()}
            className="h-9 rounded-[10px] font-bold text-[12px]"
          >
            {saveConnection.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {connection ? 'تغيير الاتصال' : 'حفظ الاتصال'}
          </Button>
        </div>
      </div>
    </div>
  )
}
