import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import type { Order, User, Product } from "@/lib/models"

export const GET = requireAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get("type") || "summary"
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const db = await getDatabase()
    const orders = db.collection<Order>("orders")
    const users = db.collection<User>("users")
    const products = db.collection<Product>("products")

    // Build date filter
    const dateFilter: any = {}
    if (startDate) dateFilter.$gte = new Date(startDate)
    if (endDate) dateFilter.$lte = new Date(endDate)

    let report: any = {}

    switch (reportType) {
      case "summary":
        const [orderStats, userStats, productStats, revenueStats] = await Promise.all([
          orders
            .aggregate([
              ...(Object.keys(dateFilter).length > 0 ? [{ $match: { createdAt: dateFilter } }] : []),
              {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 },
                  totalAmount: { $sum: "$totalAmount" },
                },
              },
            ])
            .toArray(),
          users
            .aggregate([
              ...(Object.keys(dateFilter).length > 0 ? [{ $match: { createdAt: dateFilter } }] : []),
              {
                $group: {
                  _id: "$role",
                  count: { $sum: 1 },
                },
              },
            ])
            .toArray(),
          products.countDocuments(),
          orders
            .aggregate([
              {
                $match: {
                  paymentStatus: "completed",
                  ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
                },
              },
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: "$totalAmount" },
                  totalOrders: { $sum: 1 },
                  averageOrderValue: { $avg: "$totalAmount" },
                },
              },
            ])
            .toArray(),
        ])

        report = {
          orders: orderStats,
          users: userStats,
          totalProducts: productStats,
          revenue: revenueStats[0] || { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0 },
        }
        break

      case "sales":
        report = await orders
          .aggregate([
            {
              $match: {
                paymentStatus: "completed",
                ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
              },
            },
            { $unwind: "$items" },
            {
              $lookup: {
                from: "products",
                localField: "items.productId",
                foreignField: "_id",
                as: "product",
              },
            },
            { $unwind: "$product" },
            {
              $group: {
                _id: {
                  productId: "$items.productId",
                  name: "$product.name",
                  category: "$product.category",
                },
                quantitySold: { $sum: "$items.quantity" },
                revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                orderCount: { $sum: 1 },
              },
            },
            { $sort: { revenue: -1 } },
            {
              $project: {
                productId: "$_id.productId",
                name: "$_id.name",
                category: "$_id.category",
                quantitySold: 1,
                revenue: { $round: ["$revenue", 2] },
                orderCount: 1,
                _id: 0,
              },
            },
          ])
          .toArray()
        break

      case "customers":
        report = await orders
          .aggregate([
            {
              $match: {
                ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
              },
            },
            {
              $group: {
                _id: "$userId",
                orderCount: { $sum: 1 },
                totalSpent: { $sum: "$totalAmount" },
                lastOrderDate: { $max: "$createdAt" },
              },
            },
            { $sort: { totalSpent: -1 } },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user",
              },
            },
            { $unwind: "$user" },
            {
              $project: {
                userId: "$_id",
                email: "$user.email",
                name: "$user.name",
                orderCount: 1,
                totalSpent: { $round: ["$totalSpent", 2] },
                lastOrderDate: 1,
                _id: 0,
              },
            },
          ])
          .toArray()
        break

      default:
        return Response.json({ error: "Invalid report type" }, { status: 400 })
    }

    return Response.json({
      reportType,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      generatedAt: new Date(),
      data: report,
    })
  } catch (error) {
    console.error("Admin reports error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
