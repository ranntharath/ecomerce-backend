import type { NextRequest } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import { verifyWebhookSignature } from "@/lib/bakong"
import type { Order } from "@/lib/models"
import { ObjectId } from "mongodb"

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-signature")
    const payload = await request.text()

    if (!signature) {
      return Response.json({ error: "Missing signature" }, { status: 400 })
    }

    // Verify webhook signature
    const secretKey = process.env.BAKONG_SECRET_KEY
    if (!secretKey || !verifyWebhookSignature(payload, signature, secretKey)) {
      return Response.json({ error: "Invalid signature" }, { status: 401 })
    }

    const webhookData = JSON.parse(payload)
    const { payment_id, order_id, status, transaction_id, amount, currency } = webhookData

    console.log("[v0] Bakong webhook received:", webhookData)

    const db = await getDatabase()
    const orders = db.collection<Order>("orders")

    // Find order by payment ID or order ID
    const order = await orders.findOne({
      $or: [{ paymentId: payment_id }, { _id: new ObjectId(order_id) }],
    })

    if (!order) {
      console.error("[v0] Order not found for payment:", payment_id)
      return Response.json({ error: "Order not found" }, { status: 404 })
    }

    // Update order based on payment status
    const updates: any = {
      updatedAt: new Date(),
    }

    switch (status) {
      case "completed":
      case "success":
        updates.paymentStatus = "completed"
        updates.status = "processing"
        if (transaction_id) {
          updates.transactionId = transaction_id
        }
        console.log("[v0] Payment completed for order:", order._id)
        break

      case "failed":
      case "error":
        updates.paymentStatus = "failed"
        console.log("[v0] Payment failed for order:", order._id)
        break

      case "cancelled":
        updates.paymentStatus = "failed"
        updates.status = "cancelled"
        console.log("[v0] Payment cancelled for order:", order._id)
        break

      default:
        console.log("[v0] Unknown payment status:", status)
        break
    }

    await orders.updateOne({ _id: order._id }, { $set: updates })

    return Response.json({ success: true })
  } catch (error) {
    console.error("Webhook processing error:", error)
    return Response.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
