import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return (
    new Intl.NumberFormat('ar-DZ', {
      style: 'decimal',
      maximumFractionDigits: 0,
    }).format(amount) + ' دج'
  )
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
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return `FS-${Math.abs(hash).toString(36).toUpperCase()}`
}
