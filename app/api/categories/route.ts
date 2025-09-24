import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import type { Product } from "@/lib/models"

// GET /api/categories - Get all product categories (public)
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase()
    const products = db.collection<Product>("products")

    // Get distinct categories from products
    const categories = await products.distinct("category")

    // Get category counts
    const categoryCounts = await products
      .aggregate([
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            category: "$_id",
            count: 1,
            _id: 0,
          },
        },
      ])
      .toArray()

    return Response.json({
      categories: categories.sort(),
      categoryCounts,
    })
  } catch (error) {
    console.error("Get categories error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
