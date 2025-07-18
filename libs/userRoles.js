import { adminConfig } from './adminConfig';

// Define user roles and their permissions
const ROLES = {
  ADMIN: 'admin',
  CLIENT: 'client',
  USER: 'user',
  PILOT: 'pilot'
};

const PERMISSIONS = {
  // Admin permissions
  MANAGE_USERS: 'manage_users',
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_BOOKINGS: 'manage_bookings',
  MANAGE_MISSIONS: 'manage_missions',
  
  // Client permissions
  CREATE_JOBS: 'create_jobs',
  MANAGE_OWN_JOBS: 'manage_own_jobs',
  VIEW_ASSETS: 'view_assets',
  DOWNLOAD_ASSETS: 'download_assets',
  
  // User permissions
  VIEW_PROFILE: 'view_profile',
  EDIT_PROFILE: 'edit_profile',
  
  // Pilot permissions
  UPLOAD_ASSETS: 'upload_assets',
  MANAGE_MISSIONS: 'manage_missions',
  VIEW_FLIGHT_DATA: 'view_flight_data'
};

// Role-based permission mapping
const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.MANAGE_BOOKINGS,
    PERMISSIONS.MANAGE_MISSIONS,
    PERMISSIONS.CREATE_JOBS,
    PERMISSIONS.MANAGE_OWN_JOBS,
    PERMISSIONS.VIEW_ASSETS,
    PERMISSIONS.DOWNLOAD_ASSETS,
    PERMISSIONS.VIEW_PROFILE,
    PERMISSIONS.EDIT_PROFILE,
    PERMISSIONS.UPLOAD_ASSETS,
    PERMISSIONS.VIEW_FLIGHT_DATA
  ],
  [ROLES.CLIENT]: [
    PERMISSIONS.CREATE_JOBS,
    PERMISSIONS.MANAGE_OWN_JOBS,
    PERMISSIONS.VIEW_ASSETS,
    PERMISSIONS.DOWNLOAD_ASSETS,
    PERMISSIONS.VIEW_PROFILE,
    PERMISSIONS.EDIT_PROFILE
  ],
  [ROLES.PILOT]: [
    PERMISSIONS.UPLOAD_ASSETS,
    PERMISSIONS.MANAGE_MISSIONS,
    PERMISSIONS.VIEW_FLIGHT_DATA,
    PERMISSIONS.VIEW_PROFILE,
    PERMISSIONS.EDIT_PROFILE
  ],
  [ROLES.USER]: [
    PERMISSIONS.VIEW_PROFILE,
    PERMISSIONS.EDIT_PROFILE
  ]
};

// Cache for user roles to prevent repeated lookups
let userRoleCache = new Map();

// Configuration flag to switch between database and environment-based roles
const USE_DATABASE_ROLES = process.env.USE_DATABASE_ROLES === 'true';

// Get client emails from environment variable (fallback)
const getClientEmails = () => {
  const envEmails = process.env.CLIENT_EMAILS;
  if (envEmails) {
    return envEmails.split(',').map(email => email.trim()).filter(email => email);
  }
  return [];
};

// Get pilot emails from environment variable (fallback)
const getPilotEmails = () => {
  const envEmails = process.env.PILOT_EMAILS;
  if (envEmails) {
    return envEmails.split(',').map(email => email.trim()).filter(email => email);
  }
  return [];
};

// Get user role from database
const getUserRoleFromDatabase = async (email) => {
  try {
    // Dynamic import to avoid circular dependency
    const { default: User } = await import('../models/User.js');
    const user = await User.findOne({ email: email.toLowerCase() }).lean();
    return user?.role || ROLES.USER;
  } catch (error) {
    console.error('Error fetching user role from database:', error);
    return ROLES.USER;
  }
};

// Get user role from environment variables (legacy)
const getUserRoleFromEnvironment = async (email) => {
  let role = ROLES.USER; // Default role
  
  // Check if user is admin
  if (adminConfig.isAdmin(email)) {
    role = ROLES.ADMIN;
  }
  // Check if user is a client
  else if (getClientEmails().includes(email)) {
    role = ROLES.CLIENT;
  }
  // Check if user is a pilot
  else if (getPilotEmails().includes(email)) {
    role = ROLES.PILOT;
  }
  
  return role;
};

export const userRoles = {
  // Get user role based on email
  getUserRole: async (email) => {
    if (!email) return ROLES.USER;
    
    // Normalize email
    const normalizedEmail = email.toLowerCase();
    
    // Check cache first
    if (userRoleCache.has(normalizedEmail)) {
      return userRoleCache.get(normalizedEmail);
    }
    
    let role;
    
    // Use database-based roles if enabled, otherwise fall back to environment
    if (USE_DATABASE_ROLES) {
      role = await getUserRoleFromDatabase(normalizedEmail);
      
      // Double-check admin status from environment for security
      if (adminConfig.isAdmin(normalizedEmail)) {
        role = ROLES.ADMIN;
      }
    } else {
      role = await getUserRoleFromEnvironment(normalizedEmail);
    }
    
    // Cache the result
    userRoleCache.set(normalizedEmail, role);
    
    return role;
  },
  
  // Get user permissions based on email
  getUserPermissions: async (email) => {
    const role = await userRoles.getUserRole(email);
    return ROLE_PERMISSIONS[role] || [];
  },
  
  // Check if user has a specific permission
  hasPermission: async (email, permission) => {
    const permissions = await userRoles.getUserPermissions(email);
    return permissions.includes(permission);
  },
  
  // Check if user has any of the specified permissions
  hasAnyPermission: async (email, permissionList) => {
    const permissions = await userRoles.getUserPermissions(email);
    return permissionList.some(permission => permissions.includes(permission));
  },
  
  // Check if user has all of the specified permissions
  hasAllPermissions: async (email, permissionList) => {
    const permissions = await userRoles.getUserPermissions(email);
    return permissionList.every(permission => permissions.includes(permission));
  },
  
  // Update user role in database (admin only)
  updateUserRole: async (email, newRole, changedBy, reason = 'Role updated') => {
    if (!USE_DATABASE_ROLES) {
      throw new Error('Database roles are not enabled. Set USE_DATABASE_ROLES=true in your environment.');
    }
    
    if (!Object.values(ROLES).includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}`);
    }
    
    try {
      // Dynamic import to avoid circular dependency
      const { default: User } = await import('../models/User.js');
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        throw new Error('User not found');
      }
      
      // Prevent non-admins from creating admin users
      if (newRole === ROLES.ADMIN && !adminConfig.isAdmin(changedBy)) {
        throw new Error('Only admins can create admin users');
      }
      
      // Set metadata for role change tracking
      user._roleChangedBy = changedBy;
      user._roleChangeReason = reason;
      
      user.role = newRole;
      await user.save();
      
      // Clear cache for this user
      userRoleCache.delete(email.toLowerCase());
      
      return true;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  },
  
  // Get user role history (admin only)
  getUserRoleHistory: async (email) => {
    if (!USE_DATABASE_ROLES) {
      throw new Error('Database roles are not enabled. Set USE_DATABASE_ROLES=true in your environment.');
    }
    
    try {
      // Dynamic import to avoid circular dependency
      const { default: User } = await import('../models/User.js');
      const user = await User.findOne({ email: email.toLowerCase() }, 'roleHistory').lean();
      return user?.roleHistory || [];
    } catch (error) {
      console.error('Error fetching user role history:', error);
      return [];
    }
  },
  
  // Clear cache (useful for testing or when roles change)
  clearCache: () => {
    userRoleCache.clear();
  },
  
  // Get system configuration
  getSystemConfig: () => {
    return {
      useDatabaseRoles: USE_DATABASE_ROLES,
      roleSource: USE_DATABASE_ROLES ? 'database' : 'environment',
      cacheSize: userRoleCache.size
    };
  },
  
  // Get all role definitions
  getRoles: () => ({ ...ROLES }),
  
  // Get all permission definitions
  getPermissions: () => ({ ...PERMISSIONS }),
  
  // Get permissions for a specific role
  getRolePermissions: (role) => {
    return ROLE_PERMISSIONS[role] || [];
  },
  
  // Get navigation items based on user role
  getNavigationForRole: (role, userEmail = '') => {
    const isSleepySquidAdmin = userEmail.toLowerCase().endsWith('@sleepysquid.com');
    
    switch (role) {
      case ROLES.ADMIN:
        const adminNav = [
          { name: 'Dashboard', href: '/dashboard', icon: 'FiHome' },
          { name: 'Bookings', href: '/dashboard?section=bookings', icon: 'FiCalendar' },
          { name: 'Analytics', href: '/dashboard?section=analytics', icon: 'FiBarChart' },
          { name: 'Settings', href: '/dashboard?section=settings', icon: 'FiSettings' }
        ];
        
        // Only show Users link for SleepySquid admins
        if (isSleepySquidAdmin) {
          adminNav.splice(3, 0, { name: 'Users', href: '/dashboard?section=users', icon: 'FiUsers' });
        }
        
        return adminNav;
      case ROLES.CLIENT:
        return [
          { name: 'Dashboard', href: '/dashboard', icon: 'FiHome' },
          { name: 'My Jobs', href: '/dashboard?section=jobs', icon: 'FiFileText' },
          { name: 'Create Job', href: '/dashboard?section=create', icon: 'FiPlus' },
          { name: 'Assets', href: '/dashboard?section=assets', icon: 'FiFolder' },
          { name: 'Profile', href: '/dashboard?section=profile', icon: 'FiUser' }
        ];
      case ROLES.PILOT:
        return [
          { name: 'Dashboard', href: '/dashboard', icon: 'FiHome' },
          { name: 'Missions', href: '/dashboard?section=missions', icon: 'FiMap' },
          { name: 'Upload Assets', href: '/dashboard?section=upload', icon: 'FiUpload' },
          { name: 'Flight Data', href: '/dashboard?section=flights', icon: 'FiActivity' },
          { name: 'Profile', href: '/dashboard?section=profile', icon: 'FiUser' }
        ];
      default:
        return [
          { name: 'Dashboard', href: '/dashboard', icon: 'FiHome' },
          { name: 'Profile', href: '/dashboard?section=profile', icon: 'FiUser' }
        ];
    }
  }
};

export { ROLES, PERMISSIONS };
export default userRoles;