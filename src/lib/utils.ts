import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-DZ', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount) + ' دج'
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const clean = dateStr.replace(/[‎‏]/g, '').trim()
    return clean
  } catch {
    return dateStr
  }
}

export function generateOrderId(phone: string | number, date: string, product: string): string {
  const str = `${phone}-${date}-${product}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return `FS-${Math.abs(hash).toString(36).toUpperCase()}`
}

export const STATUS_MAP: Record<string, { label: string; color: string; var: string }> = {
  'جاري التجهيز': { label: 'جاري التجهيز', color: 'bg-[var(--status-processing)]', var: '--status-processing' },
  'قيد المعالجة': { label: 'قيد المعالجة', color: 'bg-[var(--status-processing)]', var: '--status-processing' },
  'مؤكد': { label: 'مؤكد', color: 'bg-[var(--status-confirmed)]', var: '--status-confirmed' },
  'مشحون': { label: 'مشحون', color: 'bg-[var(--status-shipped)]', var: '--status-shipped' },
  'تم التسليم': { label: 'تم التسليم', color: 'bg-[var(--status-delivered)]', var: '--status-delivered' },
  'ما جاوبش': { label: 'ما جاوبش', color: 'bg-[var(--status-no-answer)]', var: '--status-no-answer' },
  'ملغي': { label: 'ملغي', color: 'bg-[var(--status-cancelled)]', var: '--status-cancelled' },
}

export const STATUS_OPTIONS = Object.keys(STATUS_MAP)
