import mongoose from "mongoose";
import User from "@/models/User";

const connectMongo = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error(
      "Add the MONGODB_URI environment variable inside .env to use mongoose"
    );
  }
  
  // Check if already connected
  if (mongoose.connections[0].readyState) {
    return;
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
      maxPoolSize: 10,
    });
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    throw error;
  }
};

export default connectMongo;
