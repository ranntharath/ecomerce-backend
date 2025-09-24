import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import type { Order } from "@/lib/models"

export const GET = requireAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "30" // days
    const type = searchParams.get("type") || "revenue" // revenue, orders, users

    const db = await getDatabase()
    const orders = db.collection<Order>("orders")

    const daysBack = Number.parseInt(period)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysBack)

    let analytics: any[] = []

    switch (type) {
      case "revenue":
        analytics = await orders
          .aggregate([
            {
              $match: {
                createdAt: { $gte: startDate },
                paymentStatus: "completed",
              },
            },
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                  day: { $dayOfMonth: "$createdAt" },
                },
                revenue: { $sum: "$totalAmount" },
                orders: { $sum: 1 },
              },
            },
            {
              $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
            },
            {
              $project: {
                date: {
                  $dateFromParts: {
                    year: "$_id.year",
                    month: "$_id.month",
                    day: "$_id.day",
                  },
                },
                revenue: { $round: ["$revenue", 2] },
                orders: 1,
                _id: 0,
              },
            },
          ])
          .toArray()
        break

      case "orders":
        analytics = await orders
          .aggregate([
            {
              $match: {
                createdAt: { $gte: startDate },
              },
            },
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                  day: { $dayOfMonth: "$createdAt" },
                  status: "$status",
                },
                count: { $sum: 1 },
              },
            },
            {
              $group: {
                _id: {
                  year: "$_id.year",
                  month: "$_id.month",
                  day: "$_id.day",
                },
                statusBreakdown: {
                  $push: {
                    status: "$_id.status",
                    count: "$count",
                  },
                },
                total: { $sum: "$count" },
              },
            },
            {
              $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 },
            },
            {
              $project: {
                date: {
                  $dateFromParts: {
                    year: "$_id.year",
                    month: "$_id.month",
                    day: "$_id.day",
                  },
                },
                statusBreakdown: 1,
                total: 1,
                _id: 0,
              },
            },
          ])
          .toArray()
        break

      case "products":
        analytics = await orders
          .aggregate([
            {
              $match: {
                createdAt: { $gte: startDate },
                paymentStatus: "completed",
              },
            },
            { $unwind: "$items" },
            {
              $group: {
                _id: "$items.productId",
                totalSold: { $sum: "$items.quantity" },
                totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
              },
            },
            { $sort: { totalSold: -1 } },
            { $limit: 20 },
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
                category: "$product.category",
                totalSold: 1,
                totalRevenue: { $round: ["$totalRevenue", 2] },
                _id: 0,
              },
            },
          ])
          .toArray()
        break

      default:
        return Response.json({ error: "Invalid analytics type" }, { status: 400 })
    }

    return Response.json({
      type,
      period: daysBack,
      data: analytics,
    })
  } catch (error) {
    console.error("Admin analytics error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
