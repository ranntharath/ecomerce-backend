import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth"
import type { User } from "@/lib/models"
import { ObjectId } from "mongodb"

export const GET = requireAuth(async (request: NextRequest, authUser) => {
  try {
    const db = await getDatabase()
    const users = db.collection<User>("users")

    const user = await users.findOne({ _id: new ObjectId(authUser.userId) }, { projection: { password: 0 } })

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }

    return Response.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error("Get user error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
