import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import type { User } from "@/lib/models"
import { ObjectId } from "mongodb"

// PUT /api/admin/users/[id] - Update user role or status
export const PUT = requireAdmin(async (request: NextRequest, adminUser, { params }: { params: { id: string } }) => {
  try {
    const { id } = params
    const { role, active } = await request.json()

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid user ID" }, { status: 400 })
    }

    // Prevent admin from changing their own role
    if (id === adminUser.userId) {
      return Response.json({ error: "Cannot modify your own account" }, { status: 400 })
    }

    const db = await getDatabase()
    const users = db.collection<User>("users")

    const updates: any = { updatedAt: new Date() }
    if (role && ["admin", "user"].includes(role)) {
      updates.role = role
    }
    if (typeof active === "boolean") {
      updates.active = active
    }

    const result = await users.updateOne({ _id: new ObjectId(id) }, { $set: updates })

    if (result.matchedCount === 0) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }

    const updatedUser = await users.findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } })

    return Response.json({
      message: "User updated successfully",
      user: updatedUser,
    })
  } catch (error) {
    console.error("Update user error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})

// DELETE /api/admin/users/[id] - Delete user (soft delete)
export const DELETE = requireAdmin(async (request: NextRequest, adminUser, { params }: { params: { id: string } }) => {
  try {
    const { id } = params

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid user ID" }, { status: 400 })
    }

    // Prevent admin from deleting their own account
    if (id === adminUser.userId) {
      return Response.json({ error: "Cannot delete your own account" }, { status: 400 })
    }

    const db = await getDatabase()
    const users = db.collection<User>("users")

    // Soft delete by marking as inactive
    const result = await users.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          active: false,
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    )

    if (result.matchedCount === 0) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }

    return Response.json({ message: "User deleted successfully" })
  } catch (error) {
    console.error("Delete user error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
