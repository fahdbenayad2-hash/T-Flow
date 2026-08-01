import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Cloud,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unplug,
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
import {
  GOOGLE_SHEET_FIELDS,
  autoMapGoogleSheetHeaders,
  validateGoogleSheetMapping,
  type GoogleSheetColumnMapping,
} from '~/lib/google-sheet-mapping'
import {
  useBeginGoogleOAuth,
  useDeleteGoogleAccount,
  useDeleteGoogleSheetConnection,
  useGoogleSheetHeaders,
  useGoogleSheetsOverview,
  useGoogleSpreadsheets,
  useGoogleSpreadsheetSheets,
  useSaveGoogleSheetConnection,
  useSetGoogleSheetConnectionActive,
  useSyncGoogleSheetConnection,
  type SaveGoogleSheetConnectionInput,
} from '~/lib/queries'
import { cn } from '~/lib/utils'

export const Route = createFileRoute('/_authenticated/google-sheets')({
  validateSearch: (search: Record<string, unknown>): { google?: string } =>
    typeof search.google === 'string' ? { google: search.google } : {},
  component: GoogleSheetsPage,
})

type SheetConnection = SaveGoogleSheetConnectionInput & {
  id: string
  isActive: boolean
  lastSyncedAt: string | null
  createdAt: string
}

interface SpreadsheetOption {
  id: string
  name: string
  modifiedTime?: string
}

interface SheetOption {
  sheetId: number
  title: string
  index: number
}

interface WizardState {
  id?: string
  accountId: string
  spreadsheetId: string
  sheetId: number | null
  storeName: string
  startRow: number
  mergeVariantProduct: boolean
  headers: string[]
  columnMapping: GoogleSheetColumnMapping
}

const EMPTY_WIZARD: WizardState = {
  accountId: '',
  spreadsheetId: '',
  sheetId: null,
  storeName: '',
  startRow: 2,
  mergeVariantProduct: false,
  headers: [],
  columnMapping: {},
}

function formatDate(value?: string | null) {
  if (!value) return 'لم تتم المزامنة بعد'
  return new Intl.DateTimeFormat('ar-DZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function GoogleMark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[18px] font-black shadow-sm">
      <span
        style={{
          background: 'conic-gradient(#4285f4 0 25%,#34a853 0 50%,#fbbc05 0 75%,#ea4335 0)',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }}
      >
        G
      </span>
    </span>
  )
}

function GoogleSheetsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="h-[150px] rounded-[16px] skeleton-shimmer" />
      <div className="h-[110px] rounded-[15px] skeleton-shimmer" />
      <div className="h-[300px] rounded-[15px] skeleton-shimmer" />
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-emerald-500' : 'bg-muted-foreground/35',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          checked ? 'right-[22px]' : 'right-0.5',
        )}
      />
    </button>
  )
}

function GoogleSheetsPage() {
  const { google } = Route.useSearch()
  const overview = useGoogleSheetsOverview()
  const beginOAuth = useBeginGoogleOAuth()
  const spreadsheetsMutation = useGoogleSpreadsheets()
  const sheetsMutation = useGoogleSpreadsheetSheets()
  const headersMutation = useGoogleSheetHeaders()
  const saveConnection = useSaveGoogleSheetConnection()
  const syncConnection = useSyncGoogleSheetConnection()
  const setConnectionActive = useSetGoogleSheetConnectionActive()
  const deleteConnection = useDeleteGoogleSheetConnection()
  const deleteAccount = useDeleteGoogleAccount()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<1 | 2>(1)
  const [wizard, setWizard] = useState<WizardState>(EMPTY_WIZARD)
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetOption[]>([])
  const [sheets, setSheets] = useState<SheetOption[]>([])
  const [deleteTarget, setDeleteTarget] = useState<SheetConnection | null>(null)

  const accounts = useMemo(() => overview.data?.accounts ?? [], [overview.data])
  const connections = useMemo(
    () => (overview.data?.connections ?? []) as SheetConnection[],
    [overview.data],
  )
  const selectedAccount = accounts.find((account) => account.id === wizard.accountId)
  const selectedSpreadsheet = spreadsheets.find((file) => file.id === wizard.spreadsheetId)
  const selectedSheet = sheets.find((sheet) => sheet.sheetId === wizard.sheetId)

  useEffect(() => {
    if (google === 'connected') toast.success('تم ربط حساب Google بنجاح')
    if (google === 'cancelled') toast('تم إلغاء ربط Google')
    if (google === 'failed' || google === 'invalid') {
      toast.error('تعذر ربط حساب Google، أعد المحاولة')
    }
  }, [google])

  const connectGoogle = async () => {
    try {
      const result = await beginOAuth.mutateAsync()
      window.location.assign(result.url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر بدء ربط Google')
    }
  }

  const loadSpreadsheets = async (accountId: string) => {
    setSpreadsheets([])
    setSheets([])
    if (!accountId) return
    try {
      setSpreadsheets(await spreadsheetsMutation.mutateAsync(accountId))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر جلب ملفات Google Sheet')
    }
  }

  const loadSheets = async (accountId: string, spreadsheetId: string) => {
    setSheets([])
    if (!accountId || !spreadsheetId) return
    try {
      setSheets(await sheetsMutation.mutateAsync({ accountId, spreadsheetId }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر جلب صفحات الملف')
    }
  }

  const openNewWizard = () => {
    const accountId = accounts.find((account) => account.isActive)?.id || accounts[0]?.id || ''
    setWizard({ ...EMPTY_WIZARD, accountId })
    setWizardStep(1)
    setWizardOpen(true)
    if (accountId) void loadSpreadsheets(accountId)
  }

  const openEditWizard = (connection: SheetConnection) => {
    setWizard({
      id: connection.id,
      accountId: connection.accountId,
      spreadsheetId: connection.spreadsheetId,
      sheetId: connection.sheetId,
      storeName: connection.storeName,
      startRow: connection.startRow,
      mergeVariantProduct: connection.mergeVariantProduct,
      headers: [],
      columnMapping: connection.columnMapping,
    })
    setWizardStep(1)
    setWizardOpen(true)
    void (async () => {
      try {
        const files = await spreadsheetsMutation.mutateAsync(connection.accountId)
        setSpreadsheets(files)
        const pages = await sheetsMutation.mutateAsync({
          accountId: connection.accountId,
          spreadsheetId: connection.spreadsheetId,
        })
        setSheets(pages)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'تعذر تحميل إعدادات الربط')
      }
    })()
  }

  const continueToMapping = async () => {
    if (!selectedAccount || !selectedSpreadsheet || !selectedSheet || !wizard.storeName.trim()) {
      toast.error('أكمل اختيار الحساب والملف والصفحة واسم المتجر')
      return
    }
    try {
      const result = await headersMutation.mutateAsync({
        accountId: selectedAccount.id,
        spreadsheetId: selectedSpreadsheet.id,
        sheetTitle: selectedSheet.title,
        startRow: wizard.startRow,
      })
      setWizard((current) => ({
        ...current,
        headers: result.headers,
        columnMapping:
          current.id && Object.keys(current.columnMapping).length
            ? current.columnMapping
            : autoMapGoogleSheetHeaders(result.headers),
      }))
      setWizardStep(2)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر قراءة عناوين الأعمدة')
    }
  }

  const handleSave = async () => {
    if (!selectedAccount || !selectedSpreadsheet || !selectedSheet) return
    const missing = validateGoogleSheetMapping(wizard.columnMapping)
    if (missing.length) {
      toast.error(`اربط الحقول المطلوبة: ${missing.join('، ')}`)
      return
    }
    try {
      await saveConnection.mutateAsync({
        id: wizard.id,
        accountId: selectedAccount.id,
        accountEmail: selectedAccount.email,
        spreadsheetId: selectedSpreadsheet.id,
        spreadsheetName: selectedSpreadsheet.name,
        sheetId: selectedSheet.sheetId,
        sheetTitle: selectedSheet.title,
        storeName: wizard.storeName,
        startRow: wizard.startRow,
        mergeVariantProduct: wizard.mergeVariantProduct,
        columnMapping: wizard.columnMapping,
      })
      setWizardOpen(false)
      toast.success(wizard.id ? 'تم تحديث ربط Google Sheet' : 'تم حفظ ربط Google Sheet')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر حفظ الربط')
    }
  }

  const handleSync = async (connection: SheetConnection) => {
    try {
      const result = await syncConnection.mutateAsync(connection.id)
      if (result.alreadyRunning) {
        toast('المزامنة تعمل الآن في الخلفية')
        return
      }
      toast.success(
        `تمت المزامنة: ${result.inserted} جديد، ${result.updated} محدّث، ${result.exported} مُرسل للشيت، ${result.skipped} متجاوز`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشلت المزامنة')
    }
  }

  if (overview.isLoading) return <GoogleSheetsSkeleton />
  if (overview.isError) {
    return (
      <ErrorState
        message={overview.error instanceof Error ? overview.error.message : undefined}
        onRetry={() => overview.refetch()}
      />
    )
  }

  return (
    <RoleGuard roles={['admin']}>
      <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
        <section
          className="relative overflow-hidden rounded-[16px] p-5 text-white md:p-6"
          style={{ background: 'linear-gradient(110deg, #0f172a 0%, #172554 58%, #064e3b 100%)' }}
        >
          <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-mono tracking-wider text-emerald-300">
                <FileSpreadsheet className="h-4 w-4" />
                GOOGLE SHEETS CONNECT
              </div>
              <h2 className="text-[22px] font-black md:text-[26px]">
                اربط Google Sheet واستقبل الطلبات
              </h2>
              <p className="mt-2 text-[12.5px] leading-6 text-white/65 md:text-[13px]">
                اختر الحساب والملف والصفحة، ثم طابق الأعمدة مرة واحدة. T‑Flow يمنع تكرار الطلبات
                ويحافظ على كل ربط مستقلًا.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="border-white/20 bg-white/5 text-white" asChild>
                <Link to="/integrations">
                  <ArrowRight className="h-4 w-4" />
                  ربط المتاجر
                </Link>
              </Button>
              <Button
                onClick={connectGoogle}
                disabled={beginOAuth.isPending || !overview.data?.configured}
                className="bg-white text-slate-900 hover:bg-white/90"
              >
                {beginOAuth.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleMark />
                )}
                ربط حساب Google
              </Button>
            </div>
          </div>
        </section>

        {!overview.data?.configured && (
          <section className="rounded-[14px] border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <h3 className="text-[13px] font-extrabold text-amber-500">
                  يلزم تفعيل Google OAuth مرة واحدة
                </h3>
                <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                  أضف Client ID وClient Secret في إعدادات Vercel. رابط الرجوع المطلوب:
                </p>
                <code
                  className="mt-2 block select-all break-all rounded-lg bg-background/70 px-3 py-2 text-[10.5px]"
                  dir="ltr"
                >
                  {overview.data?.redirectUri}
                </code>
              </div>
            </div>
          </section>
        )}

        {accounts.some((account) => !account.canWrite) && (
          <section className="rounded-[14px] border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <h3 className="text-[13px] font-extrabold text-amber-500">
                    فعّل المزامنة ثنائية الاتجاه
                  </h3>
                  <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                    أعد ربط حساب Google مرة واحدة حتى يتمكن T‑Flow من إرسال الحالات والملاحظات إلى
                    الشيت. روابط الملفات الحالية لن تُحذف.
                  </p>
                </div>
              </div>
              <Button onClick={connectGoogle} disabled={beginOAuth.isPending}>
                {beginOAuth.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleMark />
                )}
                تحديث صلاحيات Google
              </Button>
            </div>
          </section>
        )}

        <section className="dc-card p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-[14.5px] font-extrabold">حسابات Google</h3>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                الملفات تظهر حسب صلاحيات الحساب المختار
              </p>
            </div>
            <Button onClick={openNewWizard} disabled={!accounts.length}>
              <Plus className="h-4 w-4" />
              إضافة Sheet
            </Button>
          </div>

          {!accounts.length ? (
            <div className="mt-5 rounded-[12px] border border-dashed border-border p-5 text-center">
              <Cloud className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 text-[12.5px] font-bold">اربط حساب Google أولًا</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                بعدها يمكنك اختيار ملفات Google Sheet مباشرة
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              {accounts.map((account) => (
                <article
                  key={account.id}
                  className="flex min-w-[250px] flex-1 items-center justify-between gap-3 rounded-[12px] border border-border bg-background/40 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <GoogleMark />
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-bold" dir="ltr">
                        {account.email}
                      </p>
                      <p
                        className={cn(
                          'mt-0.5 text-[10.5px]',
                          account.canWrite ? 'text-emerald-500' : 'text-amber-500',
                        )}
                      >
                        <CheckCircle2 className="ml-1 inline h-3 w-3" />
                        {account.canWrite ? 'قراءة وكتابة' : 'قراءة فقط — أعد الربط'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    disabled={deleteAccount.isPending}
                    onClick={async () => {
                      if (!window.confirm(`حذف حساب ${account.email} من T‑Flow؟`)) return
                      try {
                        await deleteAccount.mutateAsync(account.id)
                        toast.success('تم حذف حساب Google')
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'تعذر حذف الحساب')
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dc-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-divider p-5">
            <div>
              <h3 className="text-[14.5px] font-extrabold">ملفات Google Sheet المربوطة</h3>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                مزامنة الطلبات وإدارة المطابقة والحالة
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => overview.refetch()}>
              <RefreshCw className={cn('h-4 w-4', overview.isFetching && 'animate-spin')} />
              تحديث
            </Button>
          </div>

          {!connections.length ? (
            <EmptyState
              icon={<FileSpreadsheet className="h-8 w-8 text-emerald-500" />}
              title="لا يوجد Google Sheet مربوط بعد"
              description="أضف أول ملف، اختر الصفحة، ثم طابق أعمدة الطلبات"
              action={
                accounts.length ? (
                  <Button onClick={openNewWizard}>
                    <Plus className="h-4 w-4" />
                    إضافة أول Sheet
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-3 p-4 xl:grid-cols-2">
              {connections.map((connection) => (
                <article
                  key={connection.id}
                  className="rounded-[14px] border border-border bg-background/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-emerald-500/10 text-emerald-500">
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-[13.5px] font-extrabold">
                          {connection.storeName}
                        </h4>
                        <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                          {connection.spreadsheetName} · {connection.sheetTitle}
                        </p>
                      </div>
                    </div>
                    <Toggle
                      checked={connection.isActive}
                      disabled={setConnectionActive.isPending}
                      onChange={async (isActive) => {
                        try {
                          await setConnectionActive.mutateAsync({
                            id: connection.id,
                            isActive,
                          })
                          toast.success(isActive ? 'تم تفعيل الربط' : 'تم إيقاف الربط')
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : 'تعذر تغيير الحالة')
                        }
                      }}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-[9px] bg-muted/55 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">الحساب</p>
                      <p className="mt-0.5 truncate text-[11px] font-semibold" dir="ltr">
                        {connection.accountEmail}
                      </p>
                    </div>
                    <div className="rounded-[9px] bg-muted/55 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground">آخر مزامنة</p>
                      <p className="mt-0.5 text-[10.5px] font-semibold">
                        {formatDate(connection.lastSyncedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-divider pt-3">
                    <Button
                      size="sm"
                      disabled={!connection.isActive || syncConnection.isPending}
                      onClick={() => handleSync(connection)}
                    >
                      {syncConnection.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      مزامنة الآن
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditWizard(connection)}>
                      <Pencil className="h-4 w-4" />
                      تعديل المطابقة
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteTarget(connection)}
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {wizardStep === 1 ? 'ربط Google Sheet' : 'مطابقة أعمدة Google Sheet'}
            </DialogTitle>
            <DialogDescription>
              {wizardStep === 1
                ? 'اختر مصدر الطلبات وحدد أول سطر للبيانات'
                : 'اختر عمود الشيت المقابل لكل حقل في T‑Flow'}
            </DialogDescription>
          </DialogHeader>

          {wizardStep === 1 ? (
            <div className="grid gap-4 py-2 md:grid-cols-2">
              <label className="space-y-1.5 text-[12px] font-bold">
                حساب Google
                <select
                  className="h-10 w-full rounded-[10px] border border-input bg-background px-3 text-[12px]"
                  value={wizard.accountId}
                  onChange={(event) => {
                    const accountId = event.target.value
                    setWizard((current) => ({
                      ...current,
                      accountId,
                      spreadsheetId: '',
                      sheetId: null,
                    }))
                    void loadSpreadsheets(accountId)
                  }}
                >
                  <option value="">اختر الحساب…</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.email}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-[12px] font-bold">
                الملف
                <select
                  className="h-10 w-full rounded-[10px] border border-input bg-background px-3 text-[12px]"
                  value={wizard.spreadsheetId}
                  disabled={spreadsheetsMutation.isPending || !wizard.accountId}
                  onChange={(event) => {
                    const spreadsheetId = event.target.value
                    setWizard((current) => ({
                      ...current,
                      spreadsheetId,
                      sheetId: null,
                    }))
                    void loadSheets(wizard.accountId, spreadsheetId)
                  }}
                >
                  <option value="">
                    {spreadsheetsMutation.isPending ? 'جاري تحميل الملفات…' : 'اختر الملف…'}
                  </option>
                  {spreadsheets.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-[12px] font-bold">
                الصفحة (Sheet)
                <select
                  className="h-10 w-full rounded-[10px] border border-input bg-background px-3 text-[12px]"
                  value={wizard.sheetId ?? ''}
                  disabled={sheetsMutation.isPending || !wizard.spreadsheetId}
                  onChange={(event) =>
                    setWizard((current) => ({
                      ...current,
                      sheetId: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                >
                  <option value="">
                    {sheetsMutation.isPending ? 'جاري تحميل الصفحات…' : 'اختر الصفحة…'}
                  </option>
                  {sheets.map((sheet) => (
                    <option key={sheet.sheetId} value={sheet.sheetId}>
                      {sheet.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-[12px] font-bold">
                اسم المتجر
                <Input
                  value={wizard.storeName}
                  onChange={(event) =>
                    setWizard((current) => ({ ...current, storeName: event.target.value }))
                  }
                  placeholder="مثال: متجر الأحذية"
                  className="h-10"
                />
              </label>

              <label className="space-y-1.5 text-[12px] font-bold">
                البداية من السطر
                <Input
                  type="number"
                  min={2}
                  max={10000}
                  value={wizard.startRow}
                  onChange={(event) =>
                    setWizard((current) => ({
                      ...current,
                      startRow: Math.max(2, Number(event.target.value) || 2),
                    }))
                  }
                  className="h-10"
                  dir="ltr"
                />
                <span className="block text-[10.5px] font-normal text-muted-foreground">
                  عناوين الأعمدة تكون في السطر السابق
                </span>
              </label>

              <div className="flex items-center justify-between gap-3 rounded-[11px] border border-border p-3">
                <div>
                  <p className="text-[12px] font-bold">دمج اللون والمقاس مع المنتج</p>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                    مثال: حذاء - أسود - 42
                  </p>
                </div>
                <Toggle
                  checked={wizard.mergeVariantProduct}
                  onChange={(mergeVariantProduct) =>
                    setWizard((current) => ({ ...current, mergeVariantProduct }))
                  }
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 py-2 md:grid-cols-2">
              {GOOGLE_SHEET_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className="grid grid-cols-[120px_1fr] items-center gap-3 rounded-[10px] border border-border p-3"
                >
                  <span className="text-[11.5px] font-bold">
                    {field.label}
                    {field.required && <span className="mr-1 text-red-500">*</span>}
                  </span>
                  <select
                    className="h-9 min-w-0 rounded-[9px] border border-input bg-background px-2 text-[11.5px]"
                    value={wizard.columnMapping[field.key] ?? ''}
                    onChange={(event) => {
                      const value = event.target.value
                      setWizard((current) => ({
                        ...current,
                        columnMapping: {
                          ...current.columnMapping,
                          [field.key]: value === '' ? undefined : Number(value),
                        },
                      }))
                    }}
                  >
                    <option value="">غير مربوط</option>
                    {wizard.headers.map((header, index) => (
                      <option key={`${index}-${header}`} value={index}>
                        {header || `العمود ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setWizardOpen(false)}>
              إلغاء
            </Button>
            {wizardStep === 2 && (
              <Button variant="outline" onClick={() => setWizardStep(1)}>
                <ArrowRight className="h-4 w-4" />
                رجوع
              </Button>
            )}
            {wizardStep === 1 ? (
              <Button onClick={continueToMapping} disabled={headersMutation.isPending}>
                {headersMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
                مطابقة الأعمدة
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saveConnection.isPending}>
                {saveConnection.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                حفظ الربط
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف ربط Google Sheet؟</DialogTitle>
            <DialogDescription>
              سيتم حذف إعداد الربط فقط. الطلبات التي تمت مزامنتها تبقى محفوظة في T‑Flow.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-[11px] bg-muted/60 p-3">
            <Unplug className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-[12.5px] font-bold">{deleteTarget?.storeName}</p>
              <p className="text-[10.5px] text-muted-foreground">
                {deleteTarget?.spreadsheetName} · {deleteTarget?.sheetTitle}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConnection.isPending}
              onClick={async () => {
                if (!deleteTarget) return
                try {
                  await deleteConnection.mutateAsync(deleteTarget.id)
                  setDeleteTarget(null)
                  toast.success('تم حذف ربط Google Sheet')
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'تعذر حذف الربط')
                }
              }}
            >
              {deleteConnection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف الربط
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleGuard>
  )
}
