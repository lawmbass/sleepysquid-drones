import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import config from "@/config";
import connectMongo from "./mongo";
import bcrypt from "bcryptjs";

export const authOptions = {
  // Set any random key in .env.local
  secret: process.env.NEXTAUTH_SECRET,
  
  // Set the base URL for NextAuth
  url: process.env.NEXTAUTH_URL || `https://${config.domainName}`,
  
  providers: [
    // Credentials provider for username/password authentication
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const connectMongo = (await import('./mongoose')).default;
          const User = (await import('../models/User')).default;
          
          await connectMongo();
          
          // Find user by email (include password field)
          const user = await User.findOne({ 
            email: credentials.email.toLowerCase() 
          }).select('+password');
          
          if (!user) {
            return null;
          }

          // Check if user has a password (might be OAuth-only user)
          if (!user.password) {
            return null;
          }

          // Verify password
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          
          if (!isPasswordValid) {
            return null;
          }

          // Check if email is verified
          if (!user.emailVerification?.verified) {
            throw new Error("EmailNotVerified");
          }

          // Return user object (exclude password)
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            hasAccess: user.hasAccess,
          };
        } catch (error) {
          console.error('Credentials authorization error:', error);
          if (error.message === "EmailNotVerified") {
            throw error;
          }
          return null;
        }
      }
    }),
    GoogleProvider({
      // Follow the "Login with Google" tutorial to get your credentials
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      },
      async profile(profile) {
        return {
          id: profile.sub,
          name: profile.given_name ? profile.given_name : profile.name,
          email: profile.email,
          image: profile.picture,
          createdAt: new Date(),
        };
      },
    }),
  ],
  // New users will be saved in Database (MongoDB Atlas). Each user (model) has some fields like name, email, image, etc..
  // Requires a MongoDB database. Set MONOGODB_URI env variable.
  // Learn more about the model type: https://next-auth.js.org/v3/adapters/models
  ...(connectMongo && { adapter: MongoDBAdapter(connectMongo) }),

  callbacks: {
    async signIn({ user, account, profile, credentials }) {
      // Handle OAuth account linking for users after email changes or account resets
      if (account?.provider === 'google' && profile?.email) {
        try {
          const connectMongo = (await import('./mongoose')).default;
          const mongoose = (await import('mongoose')).default;
          
          await connectMongo();
          
          // Check if a user already exists with this email (direct match)
          const usersCollection = mongoose.connection.collection('users');
          const accountsCollection = mongoose.connection.collection('accounts');
          
          const existingUser = await usersCollection.findOne({ 
            email: profile.email.toLowerCase() 
          });
          
          if (existingUser) {
            // User exists - check if they have any OAuth accounts
            const existingOAuthAccount = await accountsCollection.findOne({
              userId: existingUser._id,
              provider: 'google'
            });
            
                         if (!existingOAuthAccount) {
               console.log(`User ${profile.email} exists but has no OAuth account - creating fresh OAuth account link`);
               // User exists but has no OAuth account (like after we deleted the stale one)
               // Create the OAuth account record directly to prevent NextAuth adapter conflicts
               await accountsCollection.insertOne({
                 provider: account.provider,
                 type: account.type,
                 providerAccountId: account.providerAccountId,
                 access_token: account.access_token,
                 expires_at: account.expires_at,
                 refresh_token: account.refresh_token,
                 scope: account.scope,
                 token_type: account.token_type,
                 id_token: account.id_token,
                 userId: existingUser._id
               });
               console.log('✅ Created fresh OAuth account link for existing user');
               return true;
            } else if (existingOAuthAccount.providerAccountId !== account.providerAccountId) {
              console.log(`User ${profile.email} has different Google account ID - updating OAuth account`);
              // User has OAuth account but with different provider ID (Google updated their account)
              // Update the existing OAuth account with new provider details
              await accountsCollection.updateOne(
                { _id: existingOAuthAccount._id },
                {
                  $set: {
                    providerAccountId: account.providerAccountId,
                    access_token: account.access_token,
                    expires_at: account.expires_at,
                    refresh_token: account.refresh_token,
                    scope: account.scope,
                    token_type: account.token_type,
                    id_token: account.id_token
                  }
                }
              );
              console.log('✅ Updated OAuth account with new Google provider details');
            }
          } else {
            // New OAuth user - they will be created by the adapter
            // We'll set hasAccess to true in the events callback below
            console.log(`New OAuth user will be created for ${profile.email}`);
          }
        } catch (error) {
          console.error('Error in signIn callback:', error);
        }
      }
      
      // Handle credentials sign-in
      if (account?.provider === 'credentials') {
        // Additional validation for credentials users can be added here
        return true;
      }
      
      // Allow sign-in to proceed normally
      return true;
    },
    async redirect({ url, baseUrl }) {
      // Handle relative URLs
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      
      // Handle same-origin URLs
      try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(baseUrl);
        if (urlObj.origin === baseUrlObj.origin) {
          return url;
        }
      } catch (error) {
        console.error('Invalid URL in redirect:', url);
      }
      
      // Default fallback - return to home page
      return baseUrl;
    },
    session: async ({ session, token }) => {
      if (session?.user) {
        session.user.id = token.sub;
        session.user.email = token.email || session.user.email;
        
        // Add admin status to session (server-side check)
        try {
          const { adminConfig } = await import('./adminConfig');
          const { userRoles } = await import('./userRoles');
          
          session.user.isAdmin = adminConfig.isAdmin(session.user.email);
          
          // For new users who might have just accepted an invitation,
          // ensure we get the most up-to-date role from the database
          const connectMongo = (await import('./mongoose')).default;
          const User = (await import('../models/User')).default;
          
          await connectMongo();
          
          // Check if user has an accepted invitation that was just processed
          const Invitation = (await import('../models/Invitation')).default;
          const recentInvitation = await Invitation.findOne({
            email: session.user.email.toLowerCase(),
            status: 'accepted',
            acceptedAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Within last 5 minutes
          });
          
          // Get user data from database to check access status
          const user = await User.findOne({ email: session.user.email.toLowerCase() });
          
                    // Get user role and access data
          if (user) {
            session.user.role = user.role || 'client'; 
            session.user.hasAccess = user.hasAccess || false;
          } else {
            // No user found, set defaults
            session.user.role = 'client';
            session.user.hasAccess = false;
          }
          
          if (recentInvitation) {
            // For users with recently accepted invitations, get role directly from database
            console.log(`Recent invitation found for ${session.user.email}, fetching role directly from database`);
            // Role and access were already set above, just clear cache
            userRoles.clearCache();
          } else {
            // Use cached role lookup for other users (if not already set above)
            if (!session.user.role) {
              session.user.role = await userRoles.getUserRole(session.user.email);
            }
            if (session.user.hasAccess === undefined) {
              const currentUser = await User.findOne({ email: session.user.email.toLowerCase() });
              session.user.hasAccess = currentUser?.hasAccess || false;
            }
          }
          
          // Add permissions based on role
          session.user.permissions = await userRoles.getUserPermissions(session.user.email);
          
          // Add debug logging for user access (production safe)
          if (process.env.NODE_ENV === 'development') {
            console.log(`User ${session.user.email}: Admin=${session.user.isAdmin}, Role=${session.user.role}, HasAccess=${session.user.hasAccess}`);
          }
        } catch (error) {
          console.error('Error checking user status:', error);
          session.user.isAdmin = false; // Fail safe
          session.user.role = 'client'; // Default role
          session.user.permissions = [];
        }
      }
      return session;
    },
    jwt: async ({ token, account, profile, user }) => {
      if (account && profile) {
        token.email = profile.email;
      }
      if (user) {
        token.email = user.email;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  theme: {
    brandColor: config.colors.main,
    // Remove the logo reference since it doesn't exist and causes 404 errors
    // logo: `https://${config.domainName}/logoAndName.png`,
  },
  pages: {
    signIn: '/login', // Updated to use the new generic login page
    error: '/api/auth/error',
  },
  debug: process.env.NODE_ENV === 'development',
  
  // Add custom error handling
  events: {
    async signIn(message) {
      console.log('Sign in event:', message);
    },
    async signOut(message) {
      console.log('Sign out event:', message);
    },
    async createUser(message) {
      console.log('User created:', message.user.email);
      
      // Process invitation and email verification immediately after user creation
      try {
        const connectMongo = (await import('./mongoose')).default;
        const User = (await import('../models/User')).default;
        const Invitation = (await import('../models/Invitation')).default;
        
        await connectMongo();
        
        // Find the user that was just created by NextAuth
        const newUser = await User.findOne({ email: message.user.email.toLowerCase() });
        
        if (newUser) {
          // Mark OAuth users as email verified (Google, etc. have already verified the email)
          // NextAuth only creates users through OAuth providers in this setup
          newUser.emailVerification = {
            verified: true
          };
          console.log(`Marked OAuth user ${message.user.email} as email verified`);
          
          // Check if there's a pending invitation for this email
          const invitation = await Invitation.findOne({ 
            email: message.user.email.toLowerCase(),
            status: 'pending'
          });
          
          if (invitation) {
            console.log(`Processing invitation for new user ${message.user.email}`);
            
            // Update user with invitation data
            newUser.role = invitation.role;
            newUser.hasAccess = invitation.hasAccess;
            newUser.company = invitation.company || newUser.company;
            newUser.phone = invitation.phone || newUser.phone;
            newUser.name = invitation.name || newUser.name;
            
            // Add to role history
            if (!newUser.roleHistory) {
              newUser.roleHistory = [];
            }
            newUser.roleHistory.push({
              role: invitation.role,
              changedAt: new Date(),
              changedBy: invitation.invitedBy,
              reason: 'Initial role assignment from invitation'
            });
            
            // Mark invitation as accepted
            invitation.status = 'accepted';
            invitation.acceptedAt = new Date();
            await invitation.save();
            
            console.log(`Invitation accepted for new user ${message.user.email}`);
          } else {
            // No invitation found - this is a new OAuth user signing up directly
            // Grant access by default for OAuth users since they've authenticated with a trusted provider
            console.log(`No invitation found for new OAuth user ${message.user.email} - granting default access`);
            newUser.hasAccess = true;
            newUser.role = newUser.role || 'client'; // Ensure role is set
            
            // Add to access history for tracking
            if (!newUser.accessHistory) {
              newUser.accessHistory = [];
            }
            newUser.accessHistory.push({
              hasAccess: true,
              changedAt: new Date(),
              changedBy: 'system',
              reason: 'Auto-granted access for OAuth user',
              action: 'created'
            });
          }
          
          await newUser.save();
          console.log(`Updated new user ${message.user.email} - emailVerification.verified: true, role: ${newUser.role}`);
        }
      } catch (error) {
        console.error('Error processing new user in createUser event:', error);
      }
    },
    async linkAccount(message) {
      console.log('Account linked:', message);
    },
    async session(message) {
      // Only log in development to avoid spam
      if (process.env.NODE_ENV === 'development') {
        console.log('Session active:', message.session.user.email);
      }
    },
  },
};
