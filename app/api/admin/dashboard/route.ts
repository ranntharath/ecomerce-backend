import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import type { Order, User, Product } from "@/lib/models"

export const GET = requireAdmin(async (request: NextRequest) => {
  try {
    const db = await getDatabase()
    const orders = db.collection<Order>("orders")
    const users = db.collection<User>("users")
    const products = db.collection<Product>("products")

    // Get date range for analytics
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()))
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Basic statistics
    const [totalUsers, totalProducts, totalOrders, totalRevenue] = await Promise.all([
      users.countDocuments(),
      products.countDocuments(),
      orders.countDocuments(),
      orders
        .aggregate([
          { $match: { paymentStatus: "completed" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ])
        .toArray()
        .then((result) => result[0]?.total || 0),
    ])

    // Recent statistics
    const [
      newUsersThisMonth,
      ordersThisMonth,
      revenueThisMonth,
      ordersThisWeek,
      revenueThisWeek,
      ordersToday,
      revenueToday,
    ] = await Promise.all([
      users.countDocuments({ createdAt: { $gte: startOfMonth } }),
      orders.countDocuments({ createdAt: { $gte: startOfMonth } }),
      orders
        .aggregate([
          { $match: { createdAt: { $gte: startOfMonth }, paymentStatus: "completed" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ])
        .toArray()
        .then((result) => result[0]?.total || 0),
      orders.countDocuments({ createdAt: { $gte: startOfWeek } }),
      orders
        .aggregate([
          { $match: { createdAt: { $gte: startOfWeek }, paymentStatus: "completed" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ])
        .toArray()
        .then((result) => result[0]?.total || 0),
      orders.countDocuments({ createdAt: { $gte: startOfDay } }),
      orders
        .aggregate([
          { $match: { createdAt: { $gte: startOfDay }, paymentStatus: "completed" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ])
        .toArray()
        .then((result) => result[0]?.total || 0),
    ])

    // Order status breakdown
    const orderStatusBreakdown = await orders
      .aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray()

    // Payment status breakdown
    const paymentStatusBreakdown = await orders
      .aggregate([
        {
          $group: {
            _id: "$paymentStatus",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray()

    // Top selling products
    const topProducts = await orders
      .aggregate([
        { $match: { paymentStatus: "completed" } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            totalSold: { $sum: "$items.quantity" },
            totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $project: {
            productId: "$_id",
            name: "$product.name",
            totalSold: 1,
            totalRevenue: 1,
          },
        },
      ])
      .toArray()

    // Low stock products
    const lowStockProducts = await products
      .find({ stock: { $lt: 10 } })
      .sort({ stock: 1 })
      .limit(10)
      .project({ name: 1, stock: 1, price: 1 })
      .toArray()

    // Recent orders
    const recentOrders = await orders
      .find()
      .sort({ createdAt: -1 })
      .limit(10)
      .project({
        _id: 1,
        totalAmount: 1,
        status: 1,
        paymentStatus: 1,
        createdAt: 1,
      })
      .toArray()

    return Response.json({
      overview: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: Number.parseFloat(totalRevenue.toFixed(2)),
      },
      recent: {
        newUsersThisMonth,
        ordersThisMonth,
        revenueThisMonth: Number.parseFloat(revenueThisMonth.toFixed(2)),
        ordersThisWeek,
        revenueThisWeek: Number.parseFloat(revenueThisWeek.toFixed(2)),
        ordersToday,
        revenueToday: Number.parseFloat(revenueToday.toFixed(2)),
      },
      breakdowns: {
        orderStatus: orderStatusBreakdown,
        paymentStatus: paymentStatusBreakdown,
      },
      topProducts,
      lowStockProducts,
      recentOrders,
    })
  } catch (error) {
    console.error("Admin dashboard error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
