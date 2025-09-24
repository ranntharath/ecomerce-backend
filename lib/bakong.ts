import crypto from "crypto"

// Bakong API configuration
const BAKONG_API_URL = process.env.BAKONG_API_URL || "https://api-bakong.nbc.org.kh"
const BAKONG_MERCHANT_ID = process.env.BAKONG_MERCHANT_ID
const BAKONG_API_KEY = process.env.BAKONG_API_KEY
const BAKONG_SECRET_KEY = process.env.BAKONG_SECRET_KEY

export interface BakongPaymentRequest {
  orderId: string
  amount: number
  currency: "USD" | "KHR"
  description: string
  customerInfo: {
    name: string
    email?: string
    phone?: string
  }
  returnUrl: string
  callbackUrl: string
}

export interface BakongPaymentResponse {
  success: boolean
  paymentId?: string
  paymentUrl?: string
  qrCode?: string
  error?: string
  message?: string
}

export interface BakongPaymentStatus {
  paymentId: string
  status: "pending" | "completed" | "failed" | "cancelled"
  amount: number
  currency: string
  transactionId?: string
  paidAt?: Date
  error?: string
}

// Generate signature for API requests
function generateSignature(data: any, secretKey: string): string {
  const sortedKeys = Object.keys(data).sort()
  const signString = sortedKeys.map((key) => `${key}=${data[key]}`).join("&")
  return crypto.createHmac("sha256", secretKey).update(signString).digest("hex")
}

// Verify webhook signature
export function verifyWebhookSignature(payload: string, signature: string, secretKey: string): boolean {
  const expectedSignature = crypto.createHmac("sha256", secretKey).update(payload).digest("hex")
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
}

// Create payment request
export async function createPayment(paymentRequest: BakongPaymentRequest): Promise<BakongPaymentResponse> {
  try {
    if (!BAKONG_MERCHANT_ID || !BAKONG_API_KEY || !BAKONG_SECRET_KEY) {
      throw new Error("Bakong API credentials not configured")
    }

    const requestData = {
      merchant_id: BAKONG_MERCHANT_ID,
      order_id: paymentRequest.orderId,
      amount: paymentRequest.amount.toFixed(2),
      currency: paymentRequest.currency,
      description: paymentRequest.description,
      customer_name: paymentRequest.customerInfo.name,
      customer_email: paymentRequest.customerInfo.email || "",
      customer_phone: paymentRequest.customerInfo.phone || "",
      return_url: paymentRequest.returnUrl,
      callback_url: paymentRequest.callbackUrl,
      timestamp: Math.floor(Date.now() / 1000),
    }

    // Generate signature
    const signature = generateSignature(requestData, BAKONG_SECRET_KEY)

    const response = await fetch(`${BAKONG_API_URL}/v1/payments/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BAKONG_API_KEY}`,
        "X-Signature": signature,
      },
      body: JSON.stringify(requestData),
    })

    const result = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: result.error || "Payment creation failed",
        message: result.message,
      }
    }

    return {
      success: true,
      paymentId: result.payment_id,
      paymentUrl: result.payment_url,
      qrCode: result.qr_code,
    }
  } catch (error) {
    console.error("Bakong payment creation error:", error)
    return {
      success: false,
      error: "Payment service unavailable",
      message: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Check payment status
export async function getPaymentStatus(paymentId: string): Promise<BakongPaymentStatus | null> {
  try {
    if (!BAKONG_MERCHANT_ID || !BAKONG_API_KEY || !BAKONG_SECRET_KEY) {
      throw new Error("Bakong API credentials not configured")
    }

    const requestData = {
      merchant_id: BAKONG_MERCHANT_ID,
      payment_id: paymentId,
      timestamp: Math.floor(Date.now() / 1000),
    }

    const signature = generateSignature(requestData, BAKONG_SECRET_KEY)

    const response = await fetch(`${BAKONG_API_URL}/v1/payments/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BAKONG_API_KEY}`,
        "X-Signature": signature,
      },
      body: JSON.stringify(requestData),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error("Payment status check failed:", result)
      return null
    }

    return {
      paymentId: result.payment_id,
      status: result.status,
      amount: Number.parseFloat(result.amount),
      currency: result.currency,
      transactionId: result.transaction_id,
      paidAt: result.paid_at ? new Date(result.paid_at) : undefined,
      error: result.error,
    }
  } catch (error) {
    console.error("Bakong payment status error:", error)
    return null
  }
}

// Convert USD to KHR (approximate rate - should be fetched from real API)
export function convertUSDToKHR(usdAmount: number): number {
  const exchangeRate = 4100 // Approximate rate, should be dynamic
  return Math.round(usdAmount * exchangeRate)
}

// Format amount for display
export function formatAmount(amount: number, currency: "USD" | "KHR"): string {
  if (currency === "USD") {
    return `$${amount.toFixed(2)}`
  } else {
    return `${amount.toLocaleString()} ៛`
  }
}
