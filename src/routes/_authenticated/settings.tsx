import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Globe, Shield, Save, RefreshCw, CheckCircle, Trash2, Moon, Bell, Copy } from 'lucide-react'
import { RoleGuard } from '~/components/role-guard'
import { OrderMigrationCard } from '~/components/order-migration-card'
import toast from 'react-hot-toast'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
      style={{
        background: checked ? '#e31e24' : 'var(--color-border)',
      }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform mt-0.5"
        style={{
          transform: checked ? 'translateX(-22px)' : 'translateX(2px)',
        }}
      />
    </button>
  )
}

function SettingsPage() {
  const [scriptUrl, setScriptUrl] = useState('')
  const [savedUrl, setSavedUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  const [darkMode, setDarkMode] = useState(false)
  const [alerts, setAlerts] = useState(true)
  const [duplicateDetection, setDuplicateDetection] = useState(true)

  // localStorage and <html> class only exist in the browser — sync after hydration
  // to avoid an SSR mismatch.
  useEffect(() => {
    const stored = localStorage.getItem('tflow_script_url') || ''
    setScriptUrl(stored)
    setSavedUrl(stored)
    setDarkMode(document.documentElement.classList.contains('dark'))
  }, [])

  const handleSaveScriptUrl = () => {
    setIsSaving(true)
    setTimeout(() => {
      localStorage.setItem('tflow_script_url', scriptUrl)
      setSavedUrl(scriptUrl)
      setIsSaving(false)
      toast.success('تم حفظ رابط Apps Script')
    }, 500)
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const url = scriptUrl || savedUrl
      if (!url) {
        setTestResult('error')
        toast.error('أدخل رابط Apps Script أولاً')
        return
      }
      const response = await fetch(url, { method: 'GET' })
      if (response.ok) {
        setTestResult('success')
        toast.success('الاتصال ناجح!')
      } else {
        setTestResult('error')
        toast.error('فشل الاتصال')
      }
    } catch {
      setTestResult('error')
      toast.error('فشل الاتصال — تحقق من الرابط')
    } finally {
      setIsTesting(false)
    }
  }

  const handleToggleDark = (v: boolean) => {
    setDarkMode(v)
    document.documentElement.classList.toggle('dark', v)
  }

  return (
    <RoleGuard roles={['admin']}>
      <div
        className="flex flex-col gap-5 mx-auto"
        style={{ maxWidth: '720px', animation: 'tfUp 0.4s ease both' }}
      >
        {/* Connection */}
        <div className="dc-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[14.5px] font-extrabold">الاتصال</h3>
          </div>
          <p className="text-[12px] text-muted-foreground mb-4">إعدادات Google Apps Script</p>

          <div className="flex gap-2">
            <Input
              value={scriptUrl}
              onChange={(e) => setScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
              className="font-mono text-[12px] h-10 rounded-[11px] flex-1"
              dir="ltr"
            />
            <Button
              onClick={handleSaveScriptUrl}
              disabled={isSaving || scriptUrl === savedUrl}
              size="sm"
              className="h-10 rounded-[11px] font-bold text-[12px] shrink-0"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTesting || !scriptUrl}
              className="h-10 rounded-[11px] font-bold text-[12px] shrink-0"
            >
              {isTesting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              اختبار
            </Button>
          </div>

          {testResult && (
            <div className="mt-2">
              <span
                className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold"
                style={{
                  background: testResult === 'success' ? '#22c55e' : '#ef4444',
                  color: '#fff',
                }}
              >
                {testResult === 'success' ? 'متصل' : 'فشل الاتصال'}
              </span>
            </div>
          )}
        </div>

        {/* Appearance */}
        <div className="dc-card p-5">
          <h3 className="text-[14.5px] font-extrabold mb-4">المظهر</h3>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px]">الوضع الليلي</span>
              </div>
              <Toggle checked={darkMode} onChange={handleToggleDark} />
            </div>
            <div className="h-px bg-[var(--color-divider)]" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px]">إشعارات الطلبات</span>
              </div>
              <Toggle checked={alerts} onChange={setAlerts} />
            </div>
            <div className="h-px bg-[var(--color-divider)]" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px]">كشف الطلبات المكررة</span>
              </div>
              <Toggle checked={duplicateDetection} onChange={setDuplicateDetection} />
            </div>
          </div>
        </div>

        {/* Supabase */}
        <div className="dc-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[14.5px] font-extrabold">Supabase</h3>
          </div>
          <p className="text-[12px] text-muted-foreground mb-4">إعدادات قاعدة البيانات والمصادقة</p>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-[12.5px] text-muted-foreground">الحالة</span>
              <span
                className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold"
                style={{ background: '#22c55e', color: '#fff' }}
              >
                متصل
              </span>
            </div>
            <div className="h-px bg-[var(--color-divider)]" />
            <div className="flex justify-between items-center">
              <span className="text-[12.5px] text-muted-foreground">Project URL</span>
              <span className="text-[11.5px] font-mono" dir="ltr">
                {(import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(
                  /^https?:\/\//,
                  '',
                ) || '—'}
              </span>
            </div>
            <div className="h-px bg-[var(--color-divider)]" />
            <div className="flex justify-between items-center">
              <span className="text-[12.5px] text-muted-foreground">RLS</span>
              <span
                className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold"
                style={{ background: '#22c55e', color: '#fff' }}
              >
                نشط
              </span>
            </div>
          </div>
        </div>

        {/* Order storage migration */}
        <OrderMigrationCard />

        {/* Cache */}
        <div className="dc-card p-5">
          <h3 className="text-[14.5px] font-extrabold mb-1">البيانات المخزنة</h3>
          <p className="text-[12px] text-muted-foreground mb-4">إدارة الكاش والبيانات المؤقتة</p>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-[12.5px] text-muted-foreground">كاش الطلبات</span>
              <span className="text-[11.5px] font-mono">45 ثانية</span>
            </div>
            <div className="h-px bg-[var(--color-divider)]" />
            <div className="flex justify-between items-center">
              <span className="text-[12.5px] text-muted-foreground">إشعارات</span>
              <span className="text-[11.5px] font-mono">60 ثانية polling</span>
            </div>
            <div className="h-px bg-[var(--color-divider)]" />
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.clear()
                  toast.success('تم مسح البيانات المخزنة')
                }}
                className="h-9 rounded-[11px] text-destructive hover:bg-destructive/10 font-bold text-[12px]"
              >
                <Trash2 className="h-4 w-4 ml-1" />
                مسح الكاش
              </Button>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}
