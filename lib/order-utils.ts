import { getDatabase } from "@/lib/mongodb"
import type { Order, Product } from "@/lib/models"
import { ObjectId } from "mongodb"

export async function getOrderStats(userId?: string) {
  const db = await getDatabase()
  const orders = db.collection<Order>("orders")

  const filter = userId ? { userId: new ObjectId(userId) } : {}

  const stats = await orders
    .aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
        },
      },
    ])
    .toArray()

  return (
    stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      completedOrders: 0,
    }
  )
}

export async function getRecentOrders(limit = 10, userId?: string) {
  const db = await getDatabase()
  const orders = db.collection<Order>("orders")

  const filter = userId ? { userId: new ObjectId(userId) } : {}

  return orders.find(filter).sort({ createdAt: -1 }).limit(limit).toArray()
}

export async function restoreProductStock(orderId: string) {
  const db = await getDatabase()
  const orders = db.collection<Order>("orders")
  const products = db.collection<Product>("products")

  const order = await orders.findOne({ _id: new ObjectId(orderId) })
  if (!order) return false

  // Restore stock for each item
  for (const item of order.items) {
    await products.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } })
  }

  return true
}
