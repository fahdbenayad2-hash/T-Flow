export interface Order {
  _row: number
  order_id: string
  'الاسم': string
  'الهاتف': number | string
  'الولاية': string | number
  'البلدية': string
  'العنوان': string
  'الملاحظات': string
  'المنتج': string
  'اللون': string
  'المقاس': string
  'السعر': number | string
  'الكمية': number | string
  'نوع التوصيل': string
  'التاريخ': string
  'الحالة': string
}

export interface Customer {
  phone: string
  name: string
  orders: Order[]
  totalOrders: number
  totalSpent: number
  cancelledCount: number
  noAnswerCount: number
  lastOrderDate: string
  isBlacklisted: boolean
}

export interface CallLog {
  id: string
  order_id: string
  agent_id: string
  outcome: 'answered' | 'no_answer' | 'postponed'
  note: string
  follow_up_at: string | null
  created_at: string
}

export interface AuditEntry {
  id: string
  order_id: string | null
  actor_id: string | null
  action: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}

export interface UserProfile {
  id: string
  full_name: string | null
  email?: string
  roles: AppRole[]
}

export type AppRole = 'admin' | 'confirmation_agent' | 'shipping_manager'

export interface Notification {
  type: 'pending_order' | 'postponed_call' | 'duplicate_order'
  message: string
  orderId?: string
  createdAt?: string
}

export interface ServerError {
  ok: false
  error: { code: string; message: string }
}

export interface ServerSuccess<T> {
  ok: true
  data: T
}

export type ServerResult<T> = ServerSuccess<T> | ServerError
