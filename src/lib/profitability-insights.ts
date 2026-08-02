import { getOrderTotal, parseOrderQuantity } from './order-record'
import type { InventorySetting } from './product-inventory'
import { STATUS } from './sheet-mapping'
import type { Order } from './types'

export interface ProductProfitability {
  name: string
  orders: number
  units: number
  revenue: number
  productCost: number | null
  grossProfit: number | null
  grossMargin: number | null
}

function normalizeProductName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar')
}

export function buildProfitabilityInsights(orders: Order[], inventorySettings: InventorySetting[]) {
  const delivered = orders.filter((order) => order.status === STATUS.DELIVERED)
  const settingsByProduct = new Map(
    inventorySettings.map((setting) => [normalizeProductName(setting.productName), setting]),
  )
  const products = new Map<
    string,
    {
      name: string
      orders: number
      units: number
      revenue: number
      productCost: number
      costedOrders: number
    }
  >()

  let totalRevenue = 0
  let costedRevenue = 0
  let knownProductCost = 0
  let costedOrders = 0

  for (const order of delivered) {
    const name = order.product.trim() || 'غير محدد'
    const revenue = getOrderTotal(order)
    const units = parseOrderQuantity(order.quantity)
    const setting = settingsByProduct.get(normalizeProductName(name))
    const productCost = setting ? setting.unitCost * units : 0
    const current = products.get(name) ?? {
      name,
      orders: 0,
      units: 0,
      revenue: 0,
      productCost: 0,
      costedOrders: 0,
    }

    current.orders += 1
    current.units += units
    current.revenue += revenue
    totalRevenue += revenue

    if (setting) {
      current.productCost += productCost
      current.costedOrders += 1
      costedRevenue += revenue
      knownProductCost += productCost
      costedOrders += 1
    }

    products.set(name, current)
  }

  const productEntries: ProductProfitability[] = Array.from(products.values())
    .map((product) => {
      const isFullyCosted = product.costedOrders === product.orders
      const grossProfit = isFullyCosted ? product.revenue - product.productCost : null
      return {
        name: product.name,
        orders: product.orders,
        units: product.units,
        revenue: product.revenue,
        productCost: isFullyCosted ? product.productCost : null,
        grossProfit,
        grossMargin:
          grossProfit !== null && product.revenue > 0
            ? Math.round((grossProfit / product.revenue) * 100)
            : null,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  const grossProfit = costedRevenue - knownProductCost

  return {
    deliveredCount: delivered.length,
    totalRevenue,
    averageOrderValue: delivered.length ? Math.round(totalRevenue / delivered.length) : 0,
    costedOrders,
    uncostedOrders: delivered.length - costedOrders,
    costCoverage: delivered.length ? Math.round((costedOrders / delivered.length) * 100) : 0,
    costedRevenue,
    knownProductCost,
    grossProfit,
    grossMargin: costedRevenue > 0 ? Math.round((grossProfit / costedRevenue) * 100) : 0,
    isProfitComplete: delivered.length > 0 && costedOrders === delivered.length,
    productEntries,
  }
}
