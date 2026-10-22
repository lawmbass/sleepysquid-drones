import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import config from "@/config";
import { findUserByEmail } from "@/libs/db/users";
import { findRecentAcceptedInvitation } from "@/libs/db/invitations";
import { upsertGoogleUser } from "@/libs/auth/oauthUser";
import { ensureAdminRole } from "@/libs/auth/adminRole";

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  url: process.env.NEXTAUTH_URL || `https://${config.domainName}`,

  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await findUserByEmail(credentials.email.toLowerCase(), {
            includeSecrets: true,
          });

          if (!user?.password) {
            return null;
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          if (!isPasswordValid) {
            return null;
          }

          if (!user.emailVerification?.verified) {
            throw new Error("EmailNotVerified");
          }

          const stored = await ensureAdminRole(user);

          return {
            id: stored.id,
            email: stored.email,
            name: stored.name,
            image: stored.image,
            role: stored.role,
            hasAccess: stored.hasAccess,
          };
        } catch (error) {
          console.error("Credentials authorization error:", error);
          if (error.message === "EmailNotVerified") {
            throw error;
          }
          return null;
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
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

  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        try {
          await upsertGoogleUser({
            email: profile.email,
            name: profile.given_name || profile.name,
            image: profile.picture,
            providerAccountId: account.providerAccountId || profile.sub,
          });
          return true;
        } catch (error) {
          console.error("Error in signIn callback:", error);
          return false;
        }
      }

      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(baseUrl);
        if (urlObj.origin === baseUrlObj.origin) {
          return url;
        }
      } catch (error) {
        console.error("Invalid URL in redirect:", url);
      }

      return baseUrl;
    },
    session: async ({ session, token }) => {
      if (session?.user) {
        session.user.email = token.email || session.user.email;

        try {
          const { adminConfig } = await import("./adminConfig");
          const { userRoles } = await import("./userRoles");

          session.user.isAdmin = adminConfig.isAdmin(session.user.email);

          const recentInvitation = await findRecentAcceptedInvitation(
            session.user.email,
            new Date(Date.now() - 5 * 60 * 1000).toISOString()
          );

          let user = await findUserByEmail(session.user.email);
          if (user && session.user.isAdmin && user.role !== "admin") {
            try {
              user = await ensureAdminRole(user);
            } catch (persistError) {
              console.error("Failed to persist admin role:", persistError);
            }
          }
          if (user) {
            session.user.id = user.id;
            session.user.role = session.user.isAdmin ? "admin" : (user.role || "client");
            session.user.hasAccess = user.hasAccess || false;
            session.user.name = user.name || session.user.name;
            session.user.image = user.image || session.user.image;
          } else {
            session.user.id = token.userId || token.sub;
            session.user.role = session.user.isAdmin ? "admin" : "client";
            session.user.hasAccess = false;
          }

          if (recentInvitation) {
            userRoles.clearCache();
          }

          session.user.permissions = await userRoles.getUserPermissions(session.user.email);

          if (process.env.NODE_ENV === "development") {
            console.log(
              `User ${session.user.email}: Admin=${session.user.isAdmin}, Role=${session.user.role}, HasAccess=${session.user.hasAccess}`
            );
          }
        } catch (error) {
          console.error("Error checking user status:", error);
          session.user.isAdmin = false;
          session.user.role = "client";
          session.user.permissions = [];
        }
      }
      return session;
    },
    jwt: async ({ token, account, profile, user }) => {
      if (profile?.email) {
        token.email = profile.email;
      }
      if (user?.email) {
        token.email = user.email;
      }
      if (user?.id) {
        token.userId = user.id;
      }
      if (account?.providerAccountId) {
        token.providerAccountId = account.providerAccountId;
      }
      return token;
    },
  },
  // Shared SleepySquid sign-in: when NEXTAUTH_COOKIE_DOMAIN is set (e.g. ".sleepysquid.com"), the session
  // cookie is shared across sleepysquid.com and its subdomains. Unset = unchanged host-only cookie.
  ...(process.env.NEXTAUTH_COOKIE_DOMAIN ? {
    cookies: {
      sessionToken: {
        name: "__Secure-next-auth.session-token",
        options: { httpOnly: true, sameSite: "lax", path: "/", secure: true, domain: process.env.NEXTAUTH_COOKIE_DOMAIN },
      },
    },
  } : {}),
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  theme: {
    brandColor: config.colors.main,
  },
  pages: {
    signIn: "/login",
    error: "/api/auth/error",
  },
  debug: process.env.NODE_ENV === "development",
};
