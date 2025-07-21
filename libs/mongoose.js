import mongoose from "mongoose";

const connectMongo = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error(
      "Add the MONGODB_URI environment variable inside .env to use mongoose"
    );
  }
  
  // Check if already connected
  if (mongoose.connections[0].readyState === 1) {
    return mongoose.connections[0];
  }
  
  // If connecting, wait for it to complete
  if (mongoose.connections[0].readyState === 2) {
    return new Promise((resolve, reject) => {
      mongoose.connections[0].once('connected', () => resolve(mongoose.connections[0]));
      mongoose.connections[0].once('error', reject);
    });
  }
  
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection timeout settings
      serverSelectionTimeoutMS: 10000, // 10 seconds to select a server
      connectTimeoutMS: 10000, // 10 seconds to establish connection
      socketTimeoutMS: 20000, // 20 seconds for socket operations
      
      // Retry settings
      maxPoolSize: 10, // Maximum number of connections
      minPoolSize: 1, // Minimum number of connections
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      
      // Buffering settings
      bufferMaxEntries: 0, // Disable mongoose buffering
      bufferCommands: false, // Disable mongoose buffering
      
      // Other settings
      heartbeatFrequencyMS: 10000, // Send a heartbeat every 10 seconds
      retryWrites: true, // Retry writes on network errors
    });
    
    console.log("✅ Connected to MongoDB");
    return connection;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    
    // If it's a timeout error, provide more specific guidance
    if (error.name === 'MongoNetworkTimeoutError' || error.message.includes('timeout')) {
      console.error("💡 This appears to be a network timeout. Check your MongoDB connection string and network connectivity.");
    }
    
    throw error;
  }
};

export default connectMongo;
