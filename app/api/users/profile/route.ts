import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth"
import type { User } from "@/lib/models"
import { ObjectId } from "mongodb"

// GET /api/users/profile - Get user profile
export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const db = await getDatabase()
    const users = db.collection<User>("users")

    const userProfile = await users.findOne(
      { _id: new ObjectId(user.userId) },
      { projection: { password: 0 } }
    )

    if (!userProfile) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }

    return Response.json({
      user: {
        id: userProfile._id,
        email: userProfile.email,
        name: userProfile.name,
        role: userProfile.role,
        phone: userProfile.phone || null,
        avatar: userProfile.avatar || null,
        addresses: userProfile.addresses || [],
        preferences: userProfile.preferences || {},
        createdAt: userProfile.createdAt,
        updatedAt: userProfile.updatedAt,
      },
    })
  } catch (error) {
    console.error("Get profile error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})

// PUT /api/users/profile - Update user profile
export const PUT = requireAuth(async (request: NextRequest, user) => {
  try {
    const { name, phone, preferences, avatar, dateOfBirth } = await request.json()

    // validate name
    if (!name || name.trim().length < 2) {
      return Response.json({ error: "Name must be at least 2 characters" }, { status: 400 })
    }

    const db = await getDatabase()
    const users = db.collection<User>("users")

    const updates: any = {
      name: name.trim(),
      updatedAt: new Date(),
    }

    if (phone !== undefined) updates.phone = phone
    if (preferences !== undefined) updates.preferences = preferences
    if (avatar !== undefined) updates.avatar = avatar
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth

    const result = await users.updateOne(
      { _id: new ObjectId(user.userId) },
      { $set: updates }
    )

    if (result.matchedCount === 0) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }

    const updatedUser = await users.findOne(
      { _id: new ObjectId(user.userId) },
      { projection: { password: 0 } }
    )

    return Response.json({
      message: "Profile updated successfully",
      user: updatedUser,
    })
  } catch (error) {
    console.error("Update profile error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
