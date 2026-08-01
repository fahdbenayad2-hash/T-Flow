import type { OrderStatus } from './sheet-mapping'

export interface Order {
  _row: number
  _sourceOrderId?: string
  _orderedAt?: string
  order_id: string
  customerName: string
  phone: number | string
  wilaya: string | number
  baladiya: string
  address: string
  notes: string
  product: string
  color: string
  size: string
  price: number | string
  quantity: number | string
  deliveryType: string
  date: string
  status: OrderStatus | string
  lastModified?: number
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
  note: string | null
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
