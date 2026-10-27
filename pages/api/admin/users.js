import { countUsers, createUser, findUserByEmail, listUserAdminFields, listUsers, userAccessAndRoleStats } from "@/libs/db/users";
import { offerUserDelete } from "@/libs/userDeletion";
import { TEAM_ROLES, teamStats } from "@/libs/team.mjs";
import { countPendingInvitations, listPendingInvitations, pendingInvitationRoleCounts } from "@/libs/db/invitations";
import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";


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
  
  // User management: same rule as the AI admin API (@sleepysquid.com or ADMIN_EMAILS).
  const isSleepySquidAdmin = isAdmin;
  if (!isSleepySquidAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'User management is restricted to SleepySquid administrators only.'
    });
  }

  try {
    if (req.method === 'GET') {
      return handleGetUsers(req, res, session);
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

async function handleGetUsers(req, res, session) {
  try {
    // Extract query parameters
    const { 
      search,
      role,
      hasAccess,
      team,
      limit = 50, 
      page = 1,
      sort = '-createdAt'
    } = req.query;

    // Calculate pagination
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const skip = (pageNum - 1) * limitNum;

    const { users } = await listUsers({
      search,
      hasAccess,
      sort,
      limit: 1000,
      offset: 0,
    });

    const invitations = await listPendingInvitations({ search, sort });

    // Mark invitations as such and add status
    const formattedInvitations = invitations.map(invitation => ({
      ...invitation,
      _id: invitation._id,
      name: invitation.name,
      email: invitation.email,
      company: invitation.company,
      phone: invitation.phone,
      role: invitation.role,
      hasAccess: invitation.hasAccess,
      createdAt: invitation.invitedAt,
      status: 'pending',
      isPendingInvitation: true,
      invitedBy: invitation.invitedBy,
      expiresAt: invitation.expiresAt
    }));

    // Combine users and invitations
    let allItems = [...users, ...formattedInvitations];

    // Apply role filter after getting roles
    if (role) {
      allItems = allItems.filter(item => item.role === role);
    }
    // Team page: staff only (admins and pilots). Clients are managed on the Clients page.
    const teamOnly = team === '1' || team === 'true';
    if (teamOnly) allItems = allItems.filter((item) => TEAM_ROLES.includes(item.role));

    // Sort combined results
    allItems.sort((a, b) => {
      if (sort === '-createdAt') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    const adminRows = await listUserAdminFields();
    const paginatedItems = allItems.slice(skip, skip + limitNum).map((item) => {
      if (item.isPendingInvitation) return item;
      return {
        ...item,
        canDelete: offerUserDelete({
          actorEmail: session?.user?.email,
          target: item,
          admins: adminRows,
        }),
      };
    });

    // Get total count for pagination (users + invitations)
    const totalCount = await countUsers({ search, hasAccess });
    const totalInvitations = await countPendingInvitations({ search });
    const combinedCount = totalCount + totalInvitations;
    const shownCount = teamOnly ? allItems.length : combinedCount;
    const totalPages = Math.ceil(shownCount / limitNum);

    const { access, roles: roleStats } = await userAccessAndRoleStats();
    const invitationRoleStats = await pendingInvitationRoleCounts();
    const stats = [
      { _id: true, count: access.withAccess },
      { _id: false, count: access.withoutAccess },
    ];

    const formattedStats = teamOnly ? teamStats(allItems) : {
      total: combinedCount,
      users: totalCount,
      pendingInvitations: totalInvitations,
      withAccess: stats.find(s => s._id === true)?.count || 0,
      withoutAccess: stats.find(s => s._id === false)?.count || 0,
      roles: {
        admin: roleStats.admin + invitationRoleStats.admin,
        // Include legacy 'user' roles in client count since they should be migrated to client
        client: roleStats.client + invitationRoleStats.client + roleStats.user + invitationRoleStats.user,
        pilot: roleStats.pilot + invitationRoleStats.pilot
      }
    };

    return res.status(200).json({
      success: true,
      data: {
        users: paginatedItems,
        stats: formattedStats,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalCount: shownCount,
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
    const assignedRole = role || 'client';
    const validRoles = ['client', 'pilot', 'admin'];
    if (!validRoles.includes(assignedRole)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: 'Role must be one of: client, pilot, admin'
      });
    }

    // Get session for role validation
    const session = await getServerSession(req, res, authOptions);
    
    // Only allow non-client role assignment by SleepySquid admins
    // Since 'client' is the default role, allow it for everyone
    if (role && role !== 'client') {
      if (!adminConfig.isAdmin(session.user.email)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Only SleepySquid administrators can assign pilot and admin roles'
        });
      }
    }
    
    // Prevent creating admin users for non-sleepysquid emails
    if (assignedRole === 'admin' && !email.toLowerCase().endsWith('@sleepysquid.com')) {
      return res.status(403).json({
        error: 'Invalid admin assignment',
        message: 'Only SleepySquid emails can be assigned admin roles'
      });
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    const user = await createUser({
      name,
      email: email.toLowerCase(),
      company,
      phone,
      hasAccess: hasAccess || false,
      role: assignedRole,
      roleHistory: [{
        role: assignedRole,
        changedBy: session.user.email,
        changedAt: new Date().toISOString(),
        reason: `Initial role assignment: ${assignedRole}`,
      }],
    });

    return res.status(201).json({
      success: true,
      data: {
        user
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