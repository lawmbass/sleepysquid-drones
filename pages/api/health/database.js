import connectMongo from "@/libs/mongoose";
import mongoose from "mongoose";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are allowed'
    });
  }

  const startTime = Date.now();
  
  try {
    // Test MongoDB connection
    await connectMongo();
    
    // Test database operation
    const db = mongoose.connection.db;
    await db.admin().ping();
    
    const connectionTime = Date.now() - startTime;
    
    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      connectionTime: `${connectionTime}ms`,
      readyState: mongoose.connections[0].readyState,
      readyStateText: getReadyStateText(mongoose.connections[0].readyState),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const connectionTime = Date.now() - startTime;
    
    console.error('Database health check failed:', error.message);
    
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.name,
      message: error.message,
      connectionTime: `${connectionTime}ms`,
      readyState: mongoose.connections[0]?.readyState || 0,
      readyStateText: getReadyStateText(mongoose.connections[0]?.readyState || 0),
      timestamp: new Date().toISOString()
    });
  }
}

function getReadyStateText(state) {
  switch (state) {
    case 0: return 'disconnected';
    case 1: return 'connected';
    case 2: return 'connecting';
    case 3: return 'disconnecting';
    default: return 'unknown';
  }
}