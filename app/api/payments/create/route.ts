import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth"
import { createPayment } from "@/lib/bakong"
import type { Order } from "@/lib/models"
import { ObjectId } from "mongodb"

export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const { orderId, currency = "USD" } = await request.json()

    if (!orderId || !ObjectId.isValid(orderId)) {
      return Response.json({ error: "Invalid order ID" }, { status: 400 })
    }

    if (!["USD", "KHR"].includes(currency)) {
      return Response.json({ error: "Invalid currency" }, { status: 400 })
    }

    const db = await getDatabase()
    const orders = db.collection<Order>("orders")

    // Get order details
    const order = await orders.findOne({ _id: new ObjectId(orderId) })
    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 })
    }

    // Check if user owns this order
    if (order.userId.toString() !== user.userId) {
      return Response.json({ error: "Access denied" }, { status: 403 })
    }

    // Check if order is already paid
    if (order.paymentStatus === "completed") {
      return Response.json({ error: "Order already paid" }, { status: 400 })
    }

    // Create payment request
    const paymentRequest = {
      orderId: order._id!.toString(),
      amount: order.totalAmount,
      currency: currency as "USD" | "KHR",
      description: `Order #${order._id}`,
      customerInfo: {
        name: user.email, // You might want to get actual name from user profile
        email: user.email,
      },
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderId}/payment-success`,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`,
    }

    const paymentResult = await createPayment(paymentRequest)

    if (!paymentResult.success) {
      return Response.json(
        {
          error: "Payment creation failed",
          message: paymentResult.message,
        },
        { status: 400 },
      )
    }

    // Update order with payment ID
    await orders.updateOne(
      { _id: new ObjectId(orderId) },
      {
        $set: {
          paymentId: paymentResult.paymentId,
          updatedAt: new Date(),
        },
      },
    )

    return Response.json({
      success: true,
      paymentId: paymentResult.paymentId,
      paymentUrl: paymentResult.paymentUrl,
      qrCode: paymentResult.qrCode,
    })
  } catch (error) {
    console.error("Create payment error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
