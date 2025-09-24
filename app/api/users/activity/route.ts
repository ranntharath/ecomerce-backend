import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth"
import type { Order } from "@/lib/models"
import { ObjectId } from "mongodb"

export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const page = Number.parseInt(searchParams.get("page") || "1")

    const db = await getDatabase()
    const orders = db.collection<Order>("orders")

    // Get user's recent orders as activity
    const userOrders = await orders
      .find({ userId: new ObjectId(user.userId) })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .project({
        _id: 1,
        totalAmount: 1,
        status: 1,
        paymentStatus: 1,
        createdAt: 1,
        items: { $slice: 3 }, // Show first 3 items
      })
      .toArray()

    const total = await orders.countDocuments({ userId: new ObjectId(user.userId) })

    // Format activity feed
    const activities = userOrders.map((order) => ({
      id: order._id,
      type: "order",
      title: `Order #${order._id.toString().slice(-8)}`,
      description: `${order.items.length} items - $${order.totalAmount}`,
      status: order.status,
      paymentStatus: order.paymentStatus,
      date: order.createdAt,
    }))

    return Response.json({
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Get user activity error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
