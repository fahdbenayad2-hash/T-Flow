import { STATUS } from './sheet-mapping'
import type { Order } from './types'

export interface InventorySetting {
  productName: string
  stockQuantity: number
  lowStockThreshold: number
  unitCost: number
  updatedAt: string
}

export type InventoryHealth = 'healthy' | 'low' | 'out_of_stock' | 'untracked'

export interface ProductInventoryStats {
  name: string
  totalOrders: number
  orderedUnits: number
  deliveredUnits: number
  reservedUnits: number
  cancelledUnits: number
  totalRevenue: number
  colors: string[]
  sizes: string[]
  stockQuantity: number | null
  availableUnits: number | null
  lowStockThreshold: number
  unitCost: number
  inventoryValue: number | null
  health: InventoryHealth
  setting: InventorySetting | null
}

const RESERVED_STATUSES = new Set<string>([STATUS.CONFIRMED, STATUS.PREPARING, STATUS.SHIPPED])

export function aggregateProductInventory(
  orders: Order[],
  settings: InventorySetting[],
): ProductInventoryStats[] {
  const settingsByProduct = new Map(settings.map((setting) => [setting.productName, setting]))
  const products = new Map<
    string,
    Omit<
      ProductInventoryStats,
      | 'stockQuantity'
      | 'availableUnits'
      | 'lowStockThreshold'
      | 'unitCost'
      | 'inventoryValue'
      | 'health'
      | 'setting'
      | 'colors'
      | 'sizes'
    > & { colors: Set<string>; sizes: Set<string> }
  >()

  for (const order of orders) {
    const name = order.product.trim()
    if (!name) continue

    if (!products.has(name)) {
      products.set(name, {
        name,
        totalOrders: 0,
        orderedUnits: 0,
        deliveredUnits: 0,
        reservedUnits: 0,
        cancelledUnits: 0,
        totalRevenue: 0,
        colors: new Set(),
        sizes: new Set(),
      })
    }

    const product = products.get(name)!
    const quantity = Math.max(Number(order.quantity) || 1, 0)
    product.totalOrders += 1
    product.orderedUnits += quantity
    product.totalRevenue += (Number(order.price) || 0) * quantity

    if (order.status === STATUS.DELIVERED) product.deliveredUnits += quantity
    if (RESERVED_STATUSES.has(order.status)) product.reservedUnits += quantity
    if (order.status === STATUS.CANCELLED) product.cancelledUnits += quantity
    if (order.color.trim()) product.colors.add(order.color.trim())
    if (order.size.trim()) product.sizes.add(order.size.trim())
  }

  for (const setting of settings) {
    if (!products.has(setting.productName)) {
      products.set(setting.productName, {
        name: setting.productName,
        totalOrders: 0,
        orderedUnits: 0,
        deliveredUnits: 0,
        reservedUnits: 0,
        cancelledUnits: 0,
        totalRevenue: 0,
        colors: new Set(),
        sizes: new Set(),
      })
    }
  }

  return Array.from(products.values())
    .map((product) => {
      const setting = settingsByProduct.get(product.name) || null
      const stockQuantity = setting?.stockQuantity ?? null
      const availableUnits =
        stockQuantity === null ? null : Math.max(stockQuantity - product.reservedUnits, 0)
      const lowStockThreshold = setting?.lowStockThreshold ?? 5

      let health: InventoryHealth = 'untracked'
      if (availableUnits !== null) {
        if (availableUnits <= 0) health = 'out_of_stock'
        else if (availableUnits <= lowStockThreshold) health = 'low'
        else health = 'healthy'
      }

      return {
        ...product,
        colors: Array.from(product.colors),
        sizes: Array.from(product.sizes),
        stockQuantity,
        availableUnits,
        lowStockThreshold,
        unitCost: setting?.unitCost ?? 0,
        inventoryValue: availableUnits === null ? null : availableUnits * (setting?.unitCost ?? 0),
        health,
        setting,
      }
    })
    .sort((a, b) => {
      const healthPriority: Record<InventoryHealth, number> = {
        out_of_stock: 0,
        low: 1,
        untracked: 2,
        healthy: 3,
      }
      return healthPriority[a.health] - healthPriority[b.health] || b.totalRevenue - a.totalRevenue
    })
}
