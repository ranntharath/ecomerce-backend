import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth"
import type { User } from "@/lib/models"
import { ObjectId } from "mongodb"

interface Address {
  id: string
  name: string
  address: string
  city: string
  postalCode: string
  country: string
  isDefault: boolean
}

// GET /api/users/addresses - Get user addresses
export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const db = await getDatabase()
    const users = db.collection<User>("users")

    const userProfile = await users.findOne({ _id: new ObjectId(user.userId) }, { projection: { addresses: 1 } })

    return Response.json({
      addresses: userProfile?.addresses || [],
    })
  } catch (error) {
    console.error("Get addresses error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})

// POST /api/users/addresses - Add new address
export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const { name, address, city, postalCode, country, isDefault } = await request.json()

    if (!name || !address || !city || !postalCode || !country) {
      return Response.json({ error: "All address fields are required" }, { status: 400 })
    }

    const db = await getDatabase()
    const users = db.collection<User>("users")

    const newAddress: Address = {
      id: new ObjectId().toString(),
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      postalCode: postalCode.trim(),
      country: country.trim(),
      isDefault: isDefault || false,
    }

    // If this is set as default, unset other defaults
    const updateQuery: any = {
      $push: { addresses: newAddress },
      $set: { updatedAt: new Date() },
    }

    if (isDefault) {
      // First, unset all existing defaults
      await users.updateOne({ _id: new ObjectId(user.userId) }, { $set: { "addresses.$[].isDefault": false } })
    }

    await users.updateOne({ _id: new ObjectId(user.userId) }, updateQuery)

    return Response.json({
      message: "Address added successfully",
      address: newAddress,
    })
  } catch (error) {
    console.error("Add address error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
