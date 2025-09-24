import type { ObjectId } from "mongodb"

export interface User {
  _id?: ObjectId
  email: string
  password: string
  name: string
  role: "admin" | "user" | "moderator"
  phone?: string
  avatar?: string
  addresses?: Address[]
  preferences?: UserPreferences
  active?: boolean
  emailVerified?: boolean
  resetToken?: string
  resetTokenExpiry?: Date
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

export interface Product {
  _id?: ObjectId
  name: string
  description: string
  price: number
  category: string
  stock: number
  images: string[]
  featured: boolean,
  brand:String
  createdAt: Date
  updatedAt: Date
}

export interface CartItem {
  images:[]
  productId: ObjectId
  quantity: number
  price: number
}

export interface Order {
  _id?: ObjectId
  userId: ObjectId
  items: CartItem[]
  totalAmount: number
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  paymentStatus: "pending" | "completed" | "failed"
  paymentId?: string
  shippingAddress: {
    name: string
    address: string
    city: string
    postalCode: string
    country: string
  }
  createdAt: Date
  updatedAt: Date
}

export interface Cart {
  _id?: ObjectId
  userId: ObjectId
  items: CartItem[]
  createdAt: Date
  updatedAt: Date
}

export interface Address {
  id: string
  name: string
  address: string
  city: string
  postalCode: string
  country: string
  isDefault: boolean
}

export interface UserPreferences {
  emailNotifications?: boolean
  smsNotifications?: boolean
  currency?: "USD" | "KHR"
  language?: string
  theme?: "light" | "dark"
}
