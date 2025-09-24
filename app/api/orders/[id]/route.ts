import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { requireAuth, requireAdmin } from "@/lib/auth";
import type { Order, Product } from "@/lib/models";
import { ObjectId } from "mongodb";

// GET /api/orders/[id] - Get specific order
export const GET = requireAuth(async (request: NextRequest, user) => {
  try {
    // Extract id from URL
    const url = new URL(request.url);
    const id = url.pathname.split("/").pop();

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const db = await getDatabase();
    const orders = db.collection<Order>("orders");
    const products = db.collection<Product>("products");

    const order = await orders.findOne({ _id: new ObjectId(id) });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if user owns this order or is admin
    if (order.userId.toString() !== user.userId && user.role !== "admin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Populate order items with product details
    const orderWithProducts = await Promise.all(
      order.items.map(async (item) => {
        const product = await products.findOne({ _id: item.productId });
        return {
          ...item,
          product: product
            ? {
                _id: product._id,
                name: product.name,
                images: product.images,
              }
            : null,
        };
      })
    );

    return NextResponse.json({
      order: {
        ...order,
        items: orderWithProducts,
      },
    });
  } catch (error) {
    console.error("Get order error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

// PUT /api/orders/[id] - Update order status & paymentStatus (admin only)
export const PUT = requireAdmin(async (request: NextRequest, user) => {
  try {
    // Extract id from URL
    const url = new URL(request.url);
    const id = url.pathname.split("/").pop();

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const { status, paymentStatus } = await request.json();

    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    const validPaymentStatuses = ["pending", "completed", "failed"];

    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
    }

    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      return NextResponse.json({ error: "Invalid payment status" }, { status: 400 });
    }

    const db = await getDatabase();
    const orders = db.collection<Order>("orders");

    const updates: any = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (paymentStatus) updates.paymentStatus = paymentStatus;

    const result = await orders.updateOne({ _id: new ObjectId(id) }, { $set: updates });

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updatedOrder = await orders.findOne({ _id: new ObjectId(id) });

    return NextResponse.json({
      message: "Order updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Update order error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
