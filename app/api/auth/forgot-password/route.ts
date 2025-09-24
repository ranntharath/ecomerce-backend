import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import type { User } from "@/lib/models"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 })
    }

    const db = await getDatabase()
    const users = db.collection<User>("users")

    const user = await users.findOne({ email })
    if (!user) {
      // Don't reveal if email exists or not
      return Response.json({ message: "If the email exists, a reset link has been sent" })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour

    // Save reset token to user
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          resetToken,
          resetTokenExpiry,
          updatedAt: new Date(),
        },
      },
    )

    // In a real app, you would send an email here
    console.log(`[v0] Password reset token for ${email}: ${resetToken}`)
    console.log(`[v0] Reset URL: ${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`)

    return Response.json({ message: "If the email exists, a reset link has been sent" })
  } catch (error) {
    console.error("Forgot password error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
