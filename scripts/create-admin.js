// Script to create an admin user
import { MongoClient } from "mongodb"
import bcrypt from "bcryptjs"

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecomerce-backend'

async function createAdmin() {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    console.log("Connected to MongoDB")

    const db = client.db("ecommerce")
    const users = db.collection("users")

    // Check if admin already exists
    const existingAdmin = await users.findOne({ email: "admin@ecommerce.com" })
    if (existingAdmin) {
      console.log("Admin user already exists")
      return
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash("admin123", 12)
    const adminUser = {
      email: "admin@ecommerce.com",
      password: hashedPassword,
      name: "Admin User",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await users.insertOne(adminUser)
    console.log("Admin user created:", result.insertedId)
    console.log("Email: admin@ecommerce.com")
    console.log("Password: admin123")
  } catch (error) {
    console.error("Error creating admin:", error)
  } finally {
    await client.close()
    console.log("Database connection closed")
  }
}

createAdmin()
