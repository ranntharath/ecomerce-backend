import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth"
import { getPaymentStatus } from "@/lib/bakong"
import type { Order } from "@/lib/models"

export const GET = requireAuth(async (request: NextRequest, user, { params }: { params: { paymentId: string } }) => {
  try {
    const { paymentId } = params

    if (!paymentId) {
      return Response.json({ error: "Payment ID is required" }, { status: 400 })
    }

    const db = await getDatabase()
    const orders = db.collection<Order>("orders")

    // Find order by payment ID
    const order = await orders.findOne({ paymentId })
    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 })
    }

    // Check if user owns this order
    if (order.userId.toString() !== user.userId) {
      return Response.json({ error: "Access denied" }, { status: 403 })
    }

    // Get payment status from Bakong
    const paymentStatus = await getPaymentStatus(paymentId)

    if (!paymentStatus) {
      return Response.json({ error: "Unable to fetch payment status" }, { status: 500 })
    }

    // Update order if status changed
    if (paymentStatus.status === "completed" && order.paymentStatus !== "completed") {
      await orders.updateOne(
        { _id: order._id },
        {
          $set: {
            paymentStatus: "completed",
            status: "processing",
            transactionId: paymentStatus.transactionId,
            updatedAt: new Date(),
          },
        },
      )
    }

    return Response.json({
      paymentId: paymentStatus.paymentId,
      status: paymentStatus.status,
      amount: paymentStatus.amount,
      currency: paymentStatus.currency,
      transactionId: paymentStatus.transactionId,
      paidAt: paymentStatus.paidAt,
      order: {
        id: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
    })
  } catch (error) {
    console.error("Payment status check error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
})
