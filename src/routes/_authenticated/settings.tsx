import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Badge } from '~/components/ui/badge'
import { Separator } from '~/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  Settings,
  Globe,
  Shield,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { FadeIn, StaggerContainer, StaggerItem } from '~/components/page-transition'
import toast from 'react-hot-toast'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

interface AdminUser {
  id: string
  email: string
  role: string
  createdAt: string
}

function SettingsPage() {
  const [scriptUrl, setScriptUrl] = useState('')
  const [savedUrl, setSavedUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

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

  return (
    <StaggerContainer className="space-y-6">
      <FadeIn>
        <div>
          <h2 className="text-lg font-semibold">الإعدادات</h2>
          <p className="text-sm text-muted-foreground">إدارة إعدادات التطبيق والاتصال</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <Tabs defaultValue="connection" dir="rtl">
          <TabsList>
            <TabsTrigger value="connection">
              <Globe className="h-4 w-4 ml-1" />
              الاتصال
            </TabsTrigger>
            <TabsTrigger value="general">
              <Settings className="h-4 w-4 ml-1" />
              عام
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="space-y-4 mt-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Google Apps Script
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  رابط الويب هوك لاتصال Google Sheets
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>رابط End Point</Label>
                  <Input
                    value={scriptUrl}
                    onChange={(e) => setScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/..."
                    className="font-mono text-xs"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    الرابط المحفوظ في ملف .env سيُستخدم بشكل افتراضي
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSaveScriptUrl}
                    disabled={isSaving || scriptUrl === savedUrl}
                    size="sm"
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
                  >
                    {isTesting ? (
                      <RefreshCw className="h-4 w-4 ml-1 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 ml-1" />
                    )}
                    اختبار الاتصال
                  </Button>
                  {testResult && (
                    <Badge
                      variant={testResult === 'success' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {testResult === 'success' ? 'متصل' : 'فشل الاتصال'}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Supabase
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  إعدادات قاعدة البيانات والمصادقة
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">الحالة</span>
                  <Badge className="text-xs bg-[var(--status-delivered)] text-white">
                    متصل
                  </Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Project URL</span>
                  <span className="text-xs font-mono" dir="ltr">jvuoexqjnovgmhywpxzq.supabase.co</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">RLS</span>
                  <Badge className="text-xs bg-[var(--status-delivered)] text-white">
                    نشط
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general" className="space-y-4 mt-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">معلومات التطبيق</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">الاسم</span>
                  <span className="font-medium">T-Flow</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">الإصدار</span>
                  <span className="font-mono text-sm">1.0.0</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">البيئة</span>
                  <Badge variant="outline" className="text-xs">تطوير</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">TanStack Start</span>
                  <span className="font-mono text-sm">v1.x</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">React</span>
                  <span className="font-mono text-sm">19.x</span>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">البيانات المخزنة</CardTitle>
                <p className="text-sm text-muted-foreground">
                  إدارة الكاش والبيانات المؤقتة
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">كاش الطلبات</span>
                  <span className="text-xs font-mono">45 ثانية</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">إشعارات</span>
                  <span className="text-xs font-mono">60 ثانية polling</span>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      localStorage.clear()
                      toast.success('تم مسح البيانات المخزنة')
                    }}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 ml-1" />
                    مسح الكاش
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </FadeIn>
    </StaggerContainer>
  )
}
