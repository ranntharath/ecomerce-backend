import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import type { User } from "@/lib/models"

export const GET = requireAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const role = searchParams.get("role")
    const search = searchParams.get("search")
    const sortBy = searchParams.get("sortBy") || "createdAt"
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1

    const db = await getDatabase()
    const users = db.collection<User>("users")

    // Build filter
    const filter: any = {}
    if (role) filter.role = role
    if (search) {
      filter.$or = [{ email: { $regex: search, $options: "i" } }, { name: { $regex: search, $options: "i" } }]
    }

    // Get total count
    const total = await users.countDocuments(filter)

    // Get users with pagination (exclude passwords)
    const userList = await users
      .find(filter, { projection: { password: 0 } })
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()

    // Get user statistics
    const userStats = await users
      .aggregate([
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray()

    return Response.json({
      users: userList,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: userStats,
    })
  } catch (error) {
    console.error("Admin users error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
