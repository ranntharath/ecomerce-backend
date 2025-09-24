import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import type { Product } from "@/lib/models"
import { ObjectId } from "mongodb"

// GET /api/products/[id] - Get single product (public)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid product ID" }, { status: 400 })
    }

    const db = await getDatabase()
    const products = db.collection<Product>("products")

    const product = await products.findOne({ _id: new ObjectId(id) })

    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 })
    }

    return Response.json({ product })
  } catch (error) {
    console.error("Get product error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/products/[id] - Update product (admin only)
export const PUT = requireAdmin(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params
    const updates = await request.json()

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid product ID" }, { status: 400 })
    }

    // Remove fields that shouldn't be updated directly
    delete updates._id
    delete updates.createdAt
    updates.updatedAt = new Date()

    // Validate numeric fields if provided
    if (updates.price !== undefined && updates.price <= 0) {
      return Response.json({ error: "Invalid price value" }, { status: 400 })
    }
    if (updates.stock !== undefined && updates.stock < 0) {
      return Response.json({ error: "Invalid stock value" }, { status: 400 })
    }

    const db = await getDatabase()
    const products = db.collection<Product>("products")

    const result = await products.updateOne({ _id: new ObjectId(id) }, { $set: updates })

    if (result.matchedCount === 0) {
      return Response.json({ error: "Product not found" }, { status: 404 })
    }

    const updatedProduct = await products.findOne({ _id: new ObjectId(id) })

    return Response.json({
      message: "Product updated successfully",
      product: updatedProduct,
    })
  } catch (error) {
    console.error("Update product error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})

// DELETE /api/products/[id] - Delete product (admin only)
export const DELETE = requireAdmin(async (request: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const { id } = params

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid product ID" }, { status: 400 })
    }

    const db = await getDatabase()
    const products = db.collection<Product>("products")

    const result = await products.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return Response.json({ error: "Product not found" }, { status: 404 })
    }

    return Response.json({ message: "Product deleted successfully" })
  } catch (error) {
    console.error("Delete product error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
