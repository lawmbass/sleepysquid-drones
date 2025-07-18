import connectMongo from "@/libs/mongoose";
import User from "@/models/User";
import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { userRoles } from "@/libs/userRoles";

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

  try {
    // Connect to MongoDB
    await connectMongo();

    if (req.method === 'GET') {
      return handleGetUsers(req, res);
    } else if (req.method === 'POST') {
      return handleCreateUser(req, res);
    } else {
      return res.status(405).json({ 
        error: 'Method not allowed',
        message: 'Only GET and POST requests are allowed'
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

async function handleGetUsers(req, res) {
  try {
    // Extract query parameters
    const { 
      search,
      role,
      hasAccess,
      limit = 50, 
      page = 1,
      sort = '-createdAt'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (hasAccess !== undefined) {
      filter.hasAccess = hasAccess === 'true';
    }

    // Calculate pagination
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;

    // Get users with pagination
    const users = await User.find(filter)
      .sort(sort)
      .limit(limitNum)
      .skip(skip)
      .lean();

    // Users already have roles from database - no need to compute them
    const usersWithRoles = users;

    // Apply role filter after getting roles
    let filteredUsers = usersWithRoles;
    if (role) {
      filteredUsers = usersWithRoles.filter(user => user.role === role);
    }

    // Get total count for pagination
    const totalCount = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get user statistics
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$hasAccess',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get role distribution from database
    const roleDistribution = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    const roleStats = {
      admin: 0,
      client: 0,
      pilot: 0,
      user: 0
    };

    roleDistribution.forEach(({ _id, count }) => {
      if (_id && roleStats.hasOwnProperty(_id)) {
        roleStats[_id] = count;
      }
    });

    const formattedStats = {
      total: totalCount,
      withAccess: stats.find(s => s._id === true)?.count || 0,
      withoutAccess: stats.find(s => s._id === false)?.count || 0,
      roles: roleStats
    };

    return res.status(200).json({
      success: true,
      data: {
        users: filteredUsers,
        stats: formattedStats,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalCount: totalCount,
          limit: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch users'
    });
  }
}

async function handleCreateUser(req, res) {
  try {
    const { name, email, company, phone, hasAccess, role } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Name and email are required'
      });
    }

    // Validate role if provided
    const userRole = role || 'user';
    const validRoles = ['user', 'client', 'pilot', 'admin'];
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: 'Role must be one of: user, client, pilot, admin'
      });
    }

    // Prevent non-admins from creating admin users
    const session = await getServerSession(req, res, authOptions);
    if (userRole === 'admin' && !adminConfig.isAdmin(session.user.email)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Only admins can create admin users'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    // Create new user
    const user = new User({
      name,
      email: email.toLowerCase(),
      company,
      phone,
      hasAccess: hasAccess || false,
      role: userRole
    });

    // Set metadata for role tracking
    user._roleChangedBy = session.user.email;
    user._roleChangeReason = `Initial role assignment: ${userRole}`;

    await user.save();

    // Get user role
    const userRole = await userRoles.getUserRole(user.email);

    return res.status(201).json({
      success: true,
      data: {
        user: {
          ...user.toObject(),
          role: userRole
        }
      },
      message: 'User created successfully'
    });

  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create user'
    });
  }
}