export type HealthStatus = 'healthy' | 'warning' | 'critical'

export interface HealthCheck {
  id: 'database' | 'google_sheets' | 'storefront' | 'writeback' | 'delivery'
  label: string
  status: HealthStatus
  message: string
  metric: string
}

export interface SystemHealthInput {
  activeSheets: number
  lastSheetSyncAt: string | null
  failedSyncRuns24h: number
  pendingWritebacks: number
  failedWritebacks: number
  activeWebhooks: number
  rejectedWebhooks24h: number
  deliveryExceptions: number
  carrierStatus: 'connected' | 'error' | 'untested' | 'not_configured'
}

function hoursSince(value: string | null, now: Date) {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return null
  return Math.max(0, (now.getTime() - timestamp) / 3_600_000)
}

export function buildSystemHealth(input: SystemHealthInput, now = new Date()) {
  const lastSyncHours = hoursSince(input.lastSheetSyncAt, now)
  const checks: HealthCheck[] = [
    {
      id: 'database',
      label: 'قاعدة البيانات',
      status: 'healthy',
      message: 'الاتصال بـ Supabase يعمل وعزل المتجر نشط.',
      metric: 'متصل',
    },
    input.failedSyncRuns24h > 0
      ? {
          id: 'google_sheets',
          label: 'مزامنة Google Sheets',
          status: 'critical',
          message: `فشلت ${input.failedSyncRuns24h} عملية مزامنة خلال آخر 24 ساعة.`,
          metric: `${input.failedSyncRuns24h} فشل`,
        }
      : input.activeSheets === 0
        ? {
            id: 'google_sheets',
            label: 'مزامنة Google Sheets',
            status: 'warning',
            message: 'لا يوجد ملف Google Sheet نشط لهذا المتجر.',
            metric: 'غير مربوط',
          }
        : lastSyncHours === null || lastSyncHours >= 6
          ? {
              id: 'google_sheets',
              label: 'مزامنة Google Sheets',
              status: 'warning',
              message: 'لم تُسجّل مزامنة ناجحة خلال آخر 6 ساعات.',
              metric: `${input.activeSheets} رابط نشط`,
            }
          : {
              id: 'google_sheets',
              label: 'مزامنة Google Sheets',
              status: 'healthy',
              message: 'المزامنة حديثة ولا توجد عمليات فاشلة.',
              metric: `${input.activeSheets} رابط نشط`,
            },
    input.rejectedWebhooks24h >= 5
      ? {
          id: 'storefront',
          label: 'روابط المتاجر',
          status: 'critical',
          message: `تم رفض ${input.rejectedWebhooks24h} طلبات ربط خلال آخر 24 ساعة.`,
          metric: `${input.rejectedWebhooks24h} مرفوض`,
        }
      : input.rejectedWebhooks24h > 0
        ? {
            id: 'storefront',
            label: 'روابط المتاجر',
            status: 'warning',
            message: `يوجد ${input.rejectedWebhooks24h} طلب ربط مرفوض يحتاج مراجعة.`,
            metric: `${input.activeWebhooks} رابط نشط`,
          }
        : {
            id: 'storefront',
            label: 'روابط المتاجر',
            status: 'healthy',
            message:
              input.activeWebhooks > 0
                ? 'الروابط النشطة لم تسجل طلبات مرفوضة خلال 24 ساعة.'
                : 'لا توجد روابط متاجر خارجية نشطة حالياً.',
            metric: `${input.activeWebhooks} رابط نشط`,
          },
    input.failedWritebacks > 0
      ? {
          id: 'writeback',
          label: 'الكتابة إلى Sheets',
          status: 'critical',
          message: `${input.failedWritebacks} تحديثات فشلت في الرجوع إلى Google Sheets.`,
          metric: `${input.failedWritebacks} فشل`,
        }
      : input.pendingWritebacks >= 20
        ? {
            id: 'writeback',
            label: 'الكتابة إلى Sheets',
            status: 'warning',
            message: 'طابور التحديثات كبير ويحتاج مراقبة.',
            metric: `${input.pendingWritebacks} منتظر`,
          }
        : {
            id: 'writeback',
            label: 'الكتابة إلى Sheets',
            status: 'healthy',
            message: 'لا توجد تحديثات فاشلة في طابور الكتابة.',
            metric: `${input.pendingWritebacks} منتظر`,
          },
    input.carrierStatus === 'error'
      ? {
          id: 'delivery',
          label: 'خدمة التوصيل',
          status: 'critical',
          message: 'آخر اختبار لاتصال شركة التوصيل فشل.',
          metric: 'خطأ اتصال',
        }
      : input.deliveryExceptions > 0
        ? {
            id: 'delivery',
            label: 'خدمة التوصيل',
            status: 'warning',
            message: `${input.deliveryExceptions} شحنات في حالة استثناء تحتاج متابعة.`,
            metric: `${input.deliveryExceptions} استثناء`,
          }
        : {
            id: 'delivery',
            label: 'خدمة التوصيل',
            status: 'healthy',
            message:
              input.carrierStatus === 'connected'
                ? 'اتصال شركة التوصيل سليم ولا توجد شحنات استثنائية.'
                : 'لا توجد شحنات استثنائية؛ المحاكي متاح للاختبار.',
            metric: input.carrierStatus === 'connected' ? 'متصل' : 'وضع تجريبي',
          },
  ]

  const criticalCount = checks.filter((check) => check.status === 'critical').length
  const warningCount = checks.filter((check) => check.status === 'warning').length
  const score = Math.max(0, 100 - criticalCount * 30 - warningCount * 12)
  const status: HealthStatus =
    criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'healthy'

  return { checks, criticalCount, warningCount, score, status }
}
