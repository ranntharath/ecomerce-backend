import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAuth, hashPassword, comparePassword } from "@/lib/auth"
import type { User } from "@/lib/models"
import { ObjectId } from "mongodb"

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return Response.json({ error: "Current and new passwords are required" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return Response.json({ error: "New password must be at least 6 characters" }, { status: 400 })
    }

    const db = await getDatabase()
    const users = db.collection<User>("users")

    // Get current user with password
    const currentUser = await users.findOne({ _id: new ObjectId(user.userId) })
    if (!currentUser) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, currentUser.password)
    if (!isValidPassword) {
      return Response.json({ error: "Current password is incorrect" }, { status: 400 })
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword)

    // Update password
    await users.updateOne(
      { _id: new ObjectId(user.userId) },
      {
        $set: {
          password: hashedNewPassword,
          updatedAt: new Date(),
        },
      },
    )

    return Response.json({ message: "Password changed successfully" })
  } catch (error) {
    console.error("Change password error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
