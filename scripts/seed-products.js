// Script to seed initial products into the database
import { MongoClient } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ecomerce-backend"

const sampleProducts = [
  {
    name: "Wireless Bluetooth Headphones",
    description: "High-quality wireless headphones with noise cancellation and 30-hour battery life.",
    price: 199.99,
    category: "Electronics",
    stock: 50,
    images: ["/wireless-headphones.png"],
    featured: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Organic Cotton T-Shirt",
    description: "Comfortable and sustainable organic cotton t-shirt available in multiple colors.",
    price: 29.99,
    category: "Clothing",
    stock: 100,
    images: ["/cotton-tshirt.png"],
    featured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Smart Fitness Watch",
    description: "Advanced fitness tracking with heart rate monitor, GPS, and smartphone integration.",
    price: 299.99,
    category: "Electronics",
    stock: 25,
    images: ["/fitness-watch.png"],
    featured: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Ceramic Coffee Mug Set",
    description: "Set of 4 handcrafted ceramic mugs perfect for your morning coffee or tea.",
    price: 39.99,
    category: "Home & Kitchen",
    stock: 75,
    images: ["/ceramic-coffee-mugs.jpg"],
    featured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Leather Laptop Bag",
    description: "Premium leather laptop bag with multiple compartments and adjustable strap.",
    price: 149.99,
    category: "Accessories",
    stock: 30,
    images: ["/leather-laptop-bag.jpg"],
    featured: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: "Yoga Mat Premium",
    description: "Non-slip premium yoga mat with extra cushioning and carrying strap.",
    price: 59.99,
    category: "Sports & Fitness",
    stock: 40,
    images: ["/rolled-yoga-mat.png"],
    featured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

async function seedProducts() {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    console.log("Connected to MongoDB")

    const db = client.db("ecommerce")
    const products = db.collection("products")

    // Clear existing products
    await products.deleteMany({})
    console.log("Cleared existing products")

    // Insert sample products
    const result = await products.insertMany(sampleProducts)
    console.log(`Inserted ${result.insertedCount} products`)

    // Create indexes for better performance
    await products.createIndex({ name: "text", description: "text" })
    await products.createIndex({ category: 1 })
    await products.createIndex({ featured: 1 })
    await products.createIndex({ price: 1 })
    console.log("Created database indexes")
  } catch (error) {
    console.error("Error seeding products:", error)
  } finally {
    await client.close()
    console.log("Database connection closed")
  }
}

seedProducts()
