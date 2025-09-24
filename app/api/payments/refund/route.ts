import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import type { Order } from "@/lib/models"
import { ObjectId } from "mongodb"

export const POST = requireAdmin(async (request: NextRequest) => {
  try {
    const { orderId, reason } = await request.json()

    if (!orderId || !ObjectId.isValid(orderId)) {
      return Response.json({ error: "Invalid order ID" }, { status: 400 })
    }

    const db = await getDatabase()
    const orders = db.collection<Order>("orders")

    const order = await orders.findOne({ _id: new ObjectId(orderId) })
    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.paymentStatus !== "completed") {
      return Response.json({ error: "Order payment not completed" }, { status: 400 })
    }

    // In a real implementation, you would call Bakong refund API here
    // For now, we'll just update the order status
    await orders.updateOne(
      { _id: new ObjectId(orderId) },
      {
        $set: {
          status: "cancelled",
          paymentStatus: "refunded",
          refundReason: reason,
          refundedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    )

    return Response.json({
      success: true,
      message: "Refund processed successfully",
    })
  } catch (error) {
    console.error("Refund processing error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
