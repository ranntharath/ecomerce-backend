import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import type { Product } from "@/lib/models"

// GET /api/products - List all products (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const featured = searchParams.get("featured")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const search = searchParams.get("search")

    const db = await getDatabase()
    const products = db.collection<Product>("products")

    // Build filter query
    const filter: any = {}
    if (category) filter.category = category
    if (featured === "true") filter.featured = true
    if (search) {
      filter.$or = [{ name: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }]
    }

    // Get total count for pagination
    const total = await products.countDocuments(filter)

    // Get products with pagination
    const productList = await products
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()

    return Response.json({
      products: productList,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Get products error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/products - Create product (admin only)
export const POST = requireAdmin(async (request: NextRequest) => {
  try {
    const { name, description, price, category, stock, images, featured,brand } = await request.json()

    if (!name || !description || !price || !category || stock === undefined) {
      return Response.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (price <= 0 || stock < 0) {
      return Response.json({ error: "Invalid price or stock value" }, { status: 400 })
    }

    const db = await getDatabase()
    const products = db.collection<Product>("products")

    const newProduct: Product = {
      name,
      description,
      price: Number.parseFloat(price),
      category,
      stock: Number.parseInt(stock),
      images: images || [],
      featured: featured || false,
      brand,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await products.insertOne(newProduct)

    return Response.json(
      {
        message: "Product created successfully",
        product: { ...newProduct, _id: result.insertedId },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Create product error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
