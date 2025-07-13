import GoogleProvider from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import config from "@/config";
import connectMongo from "./mongo";

export const authOptions = {
  // Set any random key in .env.local
  secret: process.env.NEXTAUTH_SECRET,
  
  // Set the base URL for NextAuth
  url: process.env.NEXTAUTH_URL || `https://${config.domainName}`,
  
  providers: [
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
          session.user.role = await userRoles.getUserRole(session.user.email);
          
          // Add permissions based on role
          session.user.permissions = await userRoles.getUserPermissions(session.user.email);
          
          // Add debug logging for user access (production safe)
          if (process.env.NODE_ENV === 'development') {
            console.log(`User ${session.user.email}: Admin=${session.user.isAdmin}, Role=${session.user.role}`);
          }
        } catch (error) {
          console.error('Error checking user status:', error);
          session.user.isAdmin = false; // Fail safe
          session.user.role = 'user'; // Default role
          session.user.permissions = [];
        }
      }
      return session;
    },
    jwt: async ({ token, account, profile }) => {
      if (account && profile) {
        token.email = profile.email;
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
