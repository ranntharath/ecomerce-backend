import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth"
import type { User } from "@/lib/models"
import { ObjectId } from "mongodb"

// PUT /api/users/addresses/[id] - Update address
export const PUT = requireAuth(async (request: NextRequest, user, { params }: { params: { id: string } }) => {
  try {
    const { id } = params
    const { name, address, city, postalCode, country, isDefault } = await request.json()

    const db = await getDatabase()
    const users = db.collection<User>("users")

    // If setting as default, unset other defaults first
    if (isDefault) {
      await users.updateOne({ _id: new ObjectId(user.userId) }, { $set: { "addresses.$[].isDefault": false } })
    }

    const result = await users.updateOne(
      {
        _id: new ObjectId(user.userId),
        "addresses.id": id,
      },
      {
        $set: {
          "addresses.$.name": name,
          "addresses.$.address": address,
          "addresses.$.city": city,
          "addresses.$.postalCode": postalCode,
          "addresses.$.country": country,
          "addresses.$.isDefault": isDefault || false,
          updatedAt: new Date(),
        },
      },
    )

    if (result.matchedCount === 0) {
      return Response.json({ error: "Address not found" }, { status: 404 })
    }

    return Response.json({ message: "Address updated successfully" })
  } catch (error) {
    console.error("Update address error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})

// DELETE /api/users/addresses/[id] - Delete address
export const DELETE = requireAuth(async (request: NextRequest, user, { params }: { params: { id: string } }) => {
  try {
    const { id } = params

    const db = await getDatabase()
    const users = db.collection<User>("users")

    const result = await users.updateOne(
      { _id: new ObjectId(user.userId) },
      {
        $pull: { addresses: { id } },
        $set: { updatedAt: new Date() },
      },
    )

    if (result.matchedCount === 0) {
      return Response.json({ error: "Address not found" }, { status: 404 })
    }

    return Response.json({ message: "Address deleted successfully" })
  } catch (error) {
    console.error("Delete address error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
