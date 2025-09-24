import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import type { Order, User } from "@/lib/models"
import { ObjectId } from "mongodb"

export const GET = requireAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const status = searchParams.get("status")
    const paymentStatus = searchParams.get("paymentStatus")
    const search = searchParams.get("search")
    const sortBy = searchParams.get("sortBy") || "createdAt"
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1

    const db = await getDatabase()
    const orders = db.collection<Order>("orders")
    const users = db.collection<User>("users")

    // Build filter
    const filter: any = {}
    if (status) filter.status = status
    if (paymentStatus) filter.paymentStatus = paymentStatus
    if (search) {
      // Search by order ID or user email
      const userIds = await users
        .find({ email: { $regex: search, $options: "i" } })
        .project({ _id: 1 })
        .toArray()

      filter.$or = [
        { _id: ObjectId.isValid(search) ? new ObjectId(search) : null },
        { userId: { $in: userIds.map((u) => u._id) } },
      ].filter(Boolean)
    }

    // Get total count
    const total = await orders.countDocuments(filter)

    // Get orders with pagination
    const orderList = await orders
      .find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()

    // Populate with user information
    const ordersWithUsers = await Promise.all(
      orderList.map(async (order) => {
        const user = await users.findOne({ _id: order.userId }, { projection: { password: 0 } })
        return {
          ...order,
          user: user
            ? {
                id: user._id,
                email: user.email,
                name: user.name,
              }
            : null,
        }
      }),
    )

    return Response.json({
      orders: ordersWithUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Admin orders error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
