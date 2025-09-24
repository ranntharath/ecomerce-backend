import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth"
import type { Cart } from "@/lib/models"
import { ObjectId } from "mongodb"

// DELETE /api/cart/[productId] - Remove specific item from cart
export const DELETE = requireAuth(async (request: NextRequest, user, { params }: { params: { productId: string } }) => {
  try {
    const { productId } = params

    if (!ObjectId.isValid(productId)) {
      return Response.json({ error: "Invalid product ID" }, { status: 400 })
    }

    const db = await getDatabase()
    const carts = db.collection<Cart>("carts")

    const cart = await carts.findOne({ userId: new ObjectId(user.userId) })
    if (!cart) {
      return Response.json({ error: "Cart not found" }, { status: 404 })
    }

    // Remove item from cart
    cart.items = cart.items.filter((item) => item.productId.toString() !== productId)
    cart.updatedAt = new Date()

    await carts.replaceOne({ userId: new ObjectId(user.userId) }, cart)

    return Response.json({ message: "Item removed from cart", cart })
  } catch (error) {
    console.error("Remove from cart error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
