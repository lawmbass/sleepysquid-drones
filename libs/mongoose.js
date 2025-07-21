import mongoose from "mongoose";

// Cache for the connection promise to ensure singleton behavior
let connectionPromise = null;

const connectMongo = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error(
      "Add the MONGODB_URI environment variable inside .env to use mongoose"
    );
  }
  
  // Check if already connected - return the connection object consistently
  if (mongoose.connections[0].readyState === 1) {
    return mongoose.connections[0];
  }
  
  // If we already have a connection attempt in progress, return that promise
  if (connectionPromise) {
    return connectionPromise;
  }
  
  // If connecting, wait for it to complete with proper event handling
  if (mongoose.connections[0].readyState === 2) {
    connectionPromise = new Promise((resolve, reject) => {
      const connection = mongoose.connections[0];
      
      // Set up a timeout to prevent hanging promises
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Connection timeout: MongoDB connection took too long to establish'));
      }, 15000); // 15 second timeout
      
      // Event handlers
      const onConnected = () => {
        cleanup();
        clearTimeout(timeout);
        resolve(connection);
      };
      
      const onError = (error) => {
        cleanup();
        clearTimeout(timeout);
        connectionPromise = null; // Reset so next attempt can try again
        reject(error);
      };
      
      const onDisconnected = () => {
        cleanup();
        clearTimeout(timeout);
        connectionPromise = null; // Reset so next attempt can try again
        reject(new Error('MongoDB connection was disconnected during connection attempt'));
      };
      
      // Clean up event listeners
      const cleanup = () => {
        connection.removeListener('connected', onConnected);
        connection.removeListener('error', onError);
        connection.removeListener('disconnected', onDisconnected);
      };
      
      // Attach event listeners
      connection.once('connected', onConnected);
      connection.once('error', onError);
      connection.once('disconnected', onDisconnected);
    });
    
    return connectionPromise;
  }
  
  // Create new connection
  connectionPromise = (async () => {
    try {
      // Configure mongoose settings
      mongoose.set('bufferCommands', false); // Disable mongoose buffering
      
      await mongoose.connect(process.env.MONGODB_URI, {
        // Connection timeout settings
        serverSelectionTimeoutMS: 10000, // 10 seconds to select a server
        connectTimeoutMS: 10000, // 10 seconds to establish connection
        socketTimeoutMS: 20000, // 20 seconds for socket operations
        
        // Connection pool settings
        maxPoolSize: 10, // Maximum number of connections
        minPoolSize: 1, // Minimum number of connections
        maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
        
        // Other settings
        heartbeatFrequencyMS: 10000, // Send a heartbeat every 10 seconds
        retryWrites: true, // Retry writes on network errors
      });
      
      console.log("✅ Connected to MongoDB");
      
      // Set up global error handlers for the connection
      mongoose.connections[0].on('error', (error) => {
        console.error("❌ MongoDB connection error:", error.message);
        connectionPromise = null; // Reset promise cache on error
      });
      
      mongoose.connections[0].on('disconnected', () => {
        console.warn("⚠️ MongoDB disconnected");
        connectionPromise = null; // Reset promise cache on disconnect
      });
      
      // Always return the connection object for consistency
      return mongoose.connections[0];
    } catch (error) {
      console.error("❌ MongoDB connection error:", error.message);
      
      // Reset the connection promise so next attempt can try again
      connectionPromise = null;
      
      // If it's a timeout error, provide more specific guidance
      if (error.name === 'MongoNetworkTimeoutError' || error.message.includes('timeout')) {
        console.error("💡 This appears to be a network timeout. Check your MongoDB connection string and network connectivity.");
      }
      
      throw error;
    }
  })();
  
  return connectionPromise;
};

export default connectMongo;
