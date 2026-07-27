import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Settings,
  Globe,
  Shield,
  Save,
  RefreshCw,
  CheckCircle,
  Trash2,
} from 'lucide-react'
import { RoleGuard } from '~/components/role-guard'
import toast from 'react-hot-toast'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const [scriptUrl, setScriptUrl] = useState('')
  const [savedUrl, setSavedUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [activeTab, setActiveTab] = useState<'connection' | 'general'>('connection')

  useEffect(() => {
    const stored = localStorage.getItem('tflow_script_url') || ''
    setScriptUrl(stored)
    setSavedUrl(stored)
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

  const tabs = [
    { key: 'connection' as const, label: 'الاتصال', icon: Globe },
    { key: 'general' as const, label: 'عام', icon: Settings },
  ]

  return (
    <RoleGuard roles={['admin']}>
      <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="flex items-center gap-1.5 h-10 px-4 rounded-[11px] text-[13px] font-bold transition-all"
              style={{
                background: activeTab === t.key ? 'var(--color-foreground)' : 'var(--color-card)',
                color: activeTab === t.key ? 'var(--color-background)' : 'var(--color-muted-foreground)',
                border: '1px solid var(--color-card-border)',
              }}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'connection' && (
          <div className="flex flex-col gap-4">
            <div className="dc-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-[14.5px] font-extrabold">Google Apps Script</h3>
              </div>
              <p className="text-[12px] text-muted-foreground mb-4">رابط الويب هوك لاتصال Google Sheets</p>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-muted-foreground">رابط End Point</Label>
                <Input
                  value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/..."
                  className="font-mono text-[12px] h-10 rounded-[11px]"
                  dir="ltr"
                />
                <p className="text-[11px] text-muted-foreground">
                  الرابط المحفوظ في ملف .env سيُستخدم بشكل افتراضي
                </p>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Button
                  onClick={handleSaveScriptUrl}
                  disabled={isSaving || scriptUrl === savedUrl}
                  size="sm"
                  className="h-9 rounded-[11px] font-bold text-[12px]"
                >
                  {isSaving ? (
                    <RefreshCw className="h-4 w-4 ml-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 ml-1" />
                  )}
                  حفظ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting || !scriptUrl}
                  className="h-9 rounded-[11px] font-bold text-[12px]"
                >
                  {isTesting ? (
                    <RefreshCw className="h-4 w-4 ml-1 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 ml-1" />
                  )}
                  اختبار الاتصال
                </Button>
                {testResult && (
                  <span
                    className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold"
                    style={{
                      background: testResult === 'success' ? '#22c55e' : '#ef4444',
                      color: '#fff',
                    }}
                  >
                    {testResult === 'success' ? 'متصل' : 'فشل الاتصال'}
                  </span>
                )}
              </div>
            </div>

            <div className="dc-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-[14.5px] font-extrabold">Supabase</h3>
              </div>
              <p className="text-[12px] text-muted-foreground mb-4">إعدادات قاعدة البيانات والمصادقة</p>

              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-[12.5px] text-muted-foreground">الحالة</span>
                  <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold" style={{ background: '#22c55e', color: '#fff' }}>متصل</span>
                </div>
                <div className="h-px bg-[var(--color-divider)]" />
                <div className="flex justify-between items-center">
                  <span className="text-[12.5px] text-muted-foreground">Project URL</span>
                  <span className="text-[11.5px] font-mono" dir="ltr">jvuoexqjnovgmhywpxzq.supabase.co</span>
                </div>
                <div className="h-px bg-[var(--color-divider)]" />
                <div className="flex justify-between items-center">
                  <span className="text-[12.5px] text-muted-foreground">RLS</span>
                  <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold" style={{ background: '#22c55e', color: '#fff' }}>نشط</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="flex flex-col gap-4">
            <div className="dc-card p-5">
              <h3 className="text-[14.5px] font-extrabold mb-4">معلومات التطبيق</h3>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'الاسم', value: 'T-Flow' },
                  { label: 'الإصدار', value: '1.0.0', mono: true },
                  { label: 'البيئة', value: 'تطوير', badge: true },
                  { label: 'TanStack Start', value: 'v1.x', mono: true },
                  { label: 'React', value: '19.x', mono: true },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-[12.5px] text-muted-foreground">{item.label}</span>
                    {item.badge ? (
                      <span className="inline-flex items-center h-5 px-2 rounded-full border border-divider text-[10px] font-bold text-muted-foreground">
                        {item.value}
                      </span>
                    ) : (
                      <span className={`text-[13px] ${item.mono ? 'font-mono' : 'font-medium'}`}>{item.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

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
        )}
      </div>
    </RoleGuard>
  )
}
