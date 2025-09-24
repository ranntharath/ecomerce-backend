import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth"
import type { Order, Cart, Product } from "@/lib/models"
import { ObjectId } from "mongodb"

// GET /api/orders - Get user's orders
export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const page = Number.parseInt(searchParams.get("page") || "1")

    const db = await getDatabase()
    const orders = db.collection<Order>("orders")

    const filter = { userId: new ObjectId(user.userId) }

    const total = await orders.countDocuments(filter)
    const userOrders = await orders
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()

    return Response.json({
      orders: userOrders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Get orders error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})

// POST /api/orders - Create order from cart
export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const { shippingAddress } = await request.json()
    if (
      !shippingAddress ||
      !shippingAddress.name ||
      !shippingAddress.city ||
      !shippingAddress.telegramPhone ||
      !shippingAddress.email
    ) {
      return Response.json({ error: "Complete shipping address is required" }, { status: 400 })
    }

    const db = await getDatabase()
    const carts = db.collection<Cart>("carts")
    const orders = db.collection<Order>("orders")
    const products = db.collection<Product>("products")

    // Get user's cart
    const cart = await carts.findOne({ userId: new ObjectId(user.userId) })
    if (!cart || cart.items.length === 0) {
      return Response.json({ error: "Cart is empty" }, { status: 400 })
    }

    // Validate stock availability and calculate total
    let totalAmount = 0
    const orderItems = []

    for (const item of cart.items) {
      const product = await products.findOne({ _id: item.productId })
      if (!product) {
        return Response.json(
          {
            error: `Product ${item.productId} not found`,
          },
          { status: 400 },
        )
      }

      if (product.stock < item.quantity) {
        return Response.json(
          {
            error: `Insufficient stock for ${product.name}`,
          },
          { status: 400 },
        )
      }

      totalAmount += product.price * item.quantity
      orderItems.push({
        productId: item.productId,
        images:product.images,
        quantity: item.quantity,
        price: product.price ,
      })
    }

    // Create order
    const newOrder: Order = {
      userId: new ObjectId(user.userId),
      items: orderItems,
      totalAmount: Number.parseFloat(totalAmount.toFixed(2)),
      status: "pending",
      paymentStatus: "pending",
      shippingAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await orders.insertOne(newOrder)

    // Update product stock
    for (const item of cart.items) {
      await products.updateOne({ _id: item.productId }, { $inc: { stock: -item.quantity } })
    }

    // Clear cart
    await carts.deleteOne({ userId: new ObjectId(user.userId) })

    return Response.json(
      {
        message: "Order created successfully",
        order: { ...newOrder, _id: result.insertedId },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Create order error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
