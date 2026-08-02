import { parseOrderDate } from './order-record'
import type { Order } from './types'

export type SubscriptionPlanCode = 'starter' | 'growth' | 'pro'
export type SubscriptionResource = 'orders' | 'users' | 'storeConnections' | 'sheetConnections'

export interface SubscriptionPlan {
  code: SubscriptionPlanCode
  name: string
  description: string
  monthlyPrice: number
  featured?: boolean
  limits: Record<SubscriptionResource, number | null>
  features: string[]
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    code: 'starter',
    name: 'البداية',
    description: 'للبائع الذي يبدأ تنظيم طلباته',
    monthlyPrice: 0,
    limits: { orders: 300, users: 2, storeConnections: 1, sheetConnections: 1 },
    features: ['إدارة الطلبات والعملاء', 'ربط متجر واحد', 'Google Sheet واحد', 'التقارير الأساسية'],
  },
  {
    code: 'growth',
    name: 'النمو',
    description: 'للمتاجر التي تعمل يومياً مع فريق',
    monthlyPrice: 2900,
    featured: true,
    limits: { orders: 3000, users: 7, storeConnections: 5, sheetConnections: 5 },
    features: [
      'كل مزايا البداية',
      'التنبيهات الذكية',
      'تقارير الربحية',
      'المزامنة التلقائية',
      'فريق حتى 7 مستخدمين',
    ],
  },
  {
    code: 'pro',
    name: 'الاحترافية',
    description: 'للفرق والمتاجر ذات الحجم الكبير',
    monthlyPrice: 6900,
    limits: { orders: 25000, users: 25, storeConnections: null, sheetConnections: null },
    features: [
      'كل مزايا النمو',
      'روابط متاجر غير محدودة',
      'ملفات Sheets غير محدودة',
      'أولوية الدعم',
      'حد مرتفع للطلبات',
    ],
  },
]

export function getSubscriptionPlan(code: string | null | undefined) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.code === code) || SUBSCRIPTION_PLANS[0]
}

function algiersMonthKey(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(value)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}`
}

export function countOrdersInCurrentMonth(orders: Order[], now = new Date()) {
  const currentMonth = algiersMonthKey(now)
  return orders.filter((order) => {
    const parsed = order._orderedAt || parseOrderDate(order.date)
    if (!parsed) return false
    const date = new Date(parsed)
    return !Number.isNaN(date.getTime()) && algiersMonthKey(date) === currentMonth
  }).length
}

export function getUsagePercent(value: number, limit: number | null) {
  if (limit === null) return 0
  if (limit <= 0) return value > 0 ? 100 : 0
  return Math.min(Math.round((value / limit) * 100), 100)
}

export function getUsageStatus(value: number, limit: number | null) {
  if (limit === null) return 'normal' as const
  const ratio = limit > 0 ? value / limit : value > 0 ? 1 : 0
  if (ratio >= 1) return 'blocked' as const
  if (ratio >= 0.8) return 'warning' as const
  return 'normal' as const
}

export function getTrialDaysRemaining(trialEndsAt: string | null, now = new Date()) {
  if (!trialEndsAt) return 0
  const remaining = new Date(trialEndsAt).getTime() - now.getTime()
  return Math.max(0, Math.ceil(remaining / 86_400_000))
}
