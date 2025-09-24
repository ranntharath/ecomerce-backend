import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth"
import type { Cart, Product } from "@/lib/models"
import { ObjectId } from "mongodb"

// GET /api/cart - Get user's cart
export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    const db = await getDatabase()
    const carts = db.collection<Cart>("carts")
    const products = db.collection<Product>("products")

    let cart = await carts.findOne({ userId: new ObjectId(user.userId) })

    if (!cart) {
      // Create empty cart if none exists
      cart = {
        userId: new ObjectId(user.userId),
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await carts.insertOne(cart)
    }

    // Populate cart items with product details
    const cartWithProducts = await Promise.all(
      cart.items.map(async (item) => {
        const product = await products.findOne({ _id: item.productId })
        return {
          ...item,
          product: product
            ? {
                _id: product._id,
                name: product.name,
                price: product.price,
                images: product.images,
                stock: product.stock,
              }
            : null,
        }
      }),
    )

    // Calculate total
    const total = cartWithProducts.reduce((sum, item) => {
      return sum + item.price * item.quantity
    }, 0)

    return Response.json({
      cart: {
        ...cart,
        items: cartWithProducts,
        total: Number.parseFloat(total.toFixed(2)),
      },
    })
  } catch (error) {
    console.error("Get cart error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})

// POST /api/cart - Add item to cart (only if not exists)
export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const { productId, quantity = 1 } = await request.json()

    if (!productId || !ObjectId.isValid(productId)) {
      return Response.json({ error: "Invalid product ID" }, { status: 400 })
    }

    const db = await getDatabase()
    const carts = db.collection<Cart>("carts")
    const products = db.collection<Product>("products")

    // Check if product exists
    const product = await products.findOne({ _id: new ObjectId(productId) })
    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 })
    }

    // Get or create cart
    let cart = await carts.findOne({ userId: new ObjectId(user.userId) })
    if (!cart) {
      cart = {
        userId: new ObjectId(user.userId),
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }

    // Check if item already exists
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    )

    if (existingItem) {
      // Item already in cart — return message without adding again
      return Response.json({ error: "Product already in cart", cart }, { status: 400 })
    }

    // Add new item
    cart.items.push({
      productId: new ObjectId(productId),
      quantity,
      price: product.price,
    })

    cart.updatedAt = new Date()

    // Upsert cart
    await carts.replaceOne({ userId: new ObjectId(user.userId) }, cart, { upsert: true })

    return Response.json({ message: "Item added to cart", cart })
  } catch (error) {
    console.error("Add to cart error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})


// PUT /api/cart - Update cart item quantity
export const PUT = requireAuth(async (request: NextRequest, user) => {
  try {
    const { productId, quantity } = await request.json()

    if (!productId || !ObjectId.isValid(productId)) {
      return Response.json({ error: "Invalid product ID" }, { status: 400 })
    }

    if (quantity < 0) {
      return Response.json({ error: "Quantity cannot be negative" }, { status: 400 })
    }

    const db = await getDatabase()
    const carts = db.collection<Cart>("carts")
    const products = db.collection<Product>("products")

    const cart = await carts.findOne({ userId: new ObjectId(user.userId) })
    if (!cart) {
      return Response.json({ error: "Cart not found" }, { status: 404 })
    }

    if (quantity === 0) {
      // Remove item from cart
      cart.items = cart.items.filter((item) => item.productId.toString() !== productId)
    } else {
      // Check stock availability
      const product = await products.findOne({ _id: new ObjectId(productId) })
      if (!product) {
        return Response.json({ error: "Product not found" }, { status: 404 })
      }

      if (quantity > product.stock) {
        return Response.json({ error: "Insufficient stock" }, { status: 400 })
      }

      // Update quantity
      const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId)

      if (itemIndex >= 0) {
        cart.items[itemIndex].quantity = quantity
        cart.items[itemIndex].price = product.price // Update price in case it changed
      } else {
        return Response.json({ error: "Item not found in cart" }, { status: 404 })
      }
    }

    cart.updatedAt = new Date()

    await carts.replaceOne({ userId: new ObjectId(user.userId) }, cart)

    return Response.json({ message: "Cart updated", cart })
  } catch (error) {
    console.error("Update cart error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})

// DELETE /api/cart - Clear entire cart
export const DELETE = requireAuth(async (request: NextRequest, user) => {
  try {
    const db = await getDatabase()
    const carts = db.collection<Cart>("carts")

    await carts.deleteOne({ userId: new ObjectId(user.userId) })

    return Response.json({ message: "Cart cleared" })
  } catch (error) {
    console.error("Clear cart error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
