import connectMongo from "@/libs/mongoose";
import mongoose from "mongoose";
import User from "@/models/User";
import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
// import { userRoles } from "@/libs/userRoles";

// Apply rate limiting middleware
const rateLimitMiddleware = (req, res) => {
  return new Promise((resolve, reject) => {
    adminRateLimit(req, res, (result) => {
      if (result instanceof Error) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many admin requests. Please wait before trying again.'
        });
        return reject(result);
      }
      resolve();
    });
  });
};

export default async function handler(req, res) {
  // Apply rate limiting
  try {
    await rateLimitMiddleware(req, res);
  } catch (error) {
    return; // Response already sent by rate limiter
  }

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // SECURITY: Use NextAuth.js session-based authentication
  const session = await getServerSession(req, res, authOptions);
  
  // Check if user is authenticated
  if (!session || !session.user || !session.user.email) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please sign in.'
    });
  }
  
  // Check if user is authorized as admin
  const isAdmin = adminConfig.isAdmin(session.user.email);
  if (!isAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required. Insufficient permissions.'
    });
  }
  
  // Additional check: Only SleepySquid admins can access user management
  const isSleepySquidAdmin = session.user.email.toLowerCase().endsWith('@sleepysquid.com');
  if (!isSleepySquidAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'User management is restricted to SleepySquid administrators only.'
    });
  }

  try {
    // Connect to MongoDB
    await connectMongo();

    const { id } = req.query;

    if (req.method === 'GET') {
      return handleGetUser(req, res, id);
    } else if (req.method === 'PATCH') {
      return handleUpdateUser(req, res, id);
    } else if (req.method === 'DELETE') {
      return handleDeleteUser(req, res, id);
    } else {
      return res.status(405).json({ 
        error: 'Method not allowed',
        message: 'Only GET, PATCH, and DELETE requests are allowed'
      });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again.'
    });
  }
}

async function handleGetUser(req, res, id) {
  try {
    const user = await User.findById(id).lean();
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: user
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch user'
    });
  }
}

async function handleUpdateUser(req, res, id) {
  try {
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }

    // Prevent admins from modifying their own admin status
    if (user.email === req.session?.user?.email && 'hasAccess' in req.body) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'Cannot modify your own access status'
      });
    }

    // Update allowed fields
    const allowedFields = [
      'name', 'email', 'company', 'phone', 'bio', 'location', 'website',
      'hasAccess', 'role', 'preferences', 'notifications', 'twoFactorEnabled'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // If email is being updated, ensure it's lowercase
    if (updates.email) {
      updates.email = updates.email.toLowerCase();
      
      // Check if new email already exists
      const existingUser = await User.findOne({ 
        email: updates.email,
        _id: { $ne: id }
      });
      
      if (existingUser) {
        return res.status(409).json({
          error: 'Email already exists',
          message: 'Another user with this email already exists'
        });
      }
    }

    // Handle role changes with validation and tracking
    if (updates.role && updates.role !== user.role) {
      // Validate role
      const validRoles = ['user', 'client', 'pilot', 'admin'];
      if (!validRoles.includes(updates.role)) {
        return res.status(400).json({
          error: 'Invalid role',
          message: 'Role must be one of: user, client, pilot, admin'
        });
      }

      // Get session for role validation
      const session = await getServerSession(req, res, authOptions);
      
      // Only allow role changes by SleepySquid admins
      if (!adminConfig.isAdmin(session.user.email)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Only SleepySquid administrators can modify user roles'
        });
      }
      
      // Prevent assigning admin roles to non-sleepysquid emails
      if (updates.role === 'admin' && !user.email.toLowerCase().endsWith('@sleepysquid.com')) {
        return res.status(403).json({
          error: 'Invalid admin assignment',
          message: 'Only SleepySquid emails can be assigned admin roles'
        });
      }

      // Set metadata for role change tracking
      user._roleChangedBy = session.user.email;
      user._roleChangeReason = `Role changed from ${user.role} to ${updates.role} via admin panel`;
    }

    // Update user
    Object.assign(user, updates);
    await user.save();

    return res.status(200).json({
      success: true,
      data: {
        user: user.toObject()
      },
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update user'
    });
  }
}

async function handleDeleteUser(req, res, id) {
  try {
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }

    // Prevent admins from deleting themselves
    if (user.email === req.session?.user?.email) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'Cannot delete your own account'
      });
    }

    // Prevent deleting other admin users
    const isTargetAdmin = adminConfig.isAdmin(user.email);
    if (isTargetAdmin) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'Cannot delete admin users'
      });
    }

    // Clean up related NextAuth collections
    try {
      // Delete from accounts collection (OAuth provider accounts)
      await mongoose.connection.collection('accounts').deleteMany({ 
        userId: user._id 
      });
      
      // Delete from sessions collection
      await mongoose.connection.collection('sessions').deleteMany({ 
        userId: user._id 
      });
      
      // Delete from verification_tokens collection if any
      await mongoose.connection.collection('verification_tokens').deleteMany({ 
        identifier: user.email 
      });

      console.log(`Cleaned up NextAuth collections for user ${user.email}`);
    } catch (cleanupError) {
      console.error('Error cleaning up NextAuth collections:', cleanupError);
      // Continue with user deletion even if cleanup fails
    }

    // Delete the user
    await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete user'
    });
  }
}