import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import config from "@/config";
import { findUserByEmail } from "@/libs/db/users";
import { findRecentAcceptedInvitation } from "@/libs/db/invitations";
import { upsertGoogleUser } from "@/libs/auth/oauthUser";
import { ensureAdminRole } from "@/libs/auth/adminRole";
import { safeActiveClientIds } from "@/libs/aiPortal/db";
import { consumeLoginToken } from "@/libs/aiPortal/emailLink";

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
    // One-time emailed sign-in link for SleepySquid AI clients (tokens in portal.login_tokens, 15 min, single use).
    CredentialsProvider({
      id: "email-link",
      name: "email-link",
      credentials: { token: { label: "Token", type: "text" } },
      async authorize(credentials) {
        try {
          const email = await consumeLoginToken(credentials?.token);
          if (!email) return null;
          const user = await findUserByEmail(email);
          if (user) return { id: user.id, email: user.email, name: user.name, image: user.image };
          return { id: `ai:${email}`, email };
        } catch (error) {
          console.error("Email link authorization error:", error?.message);
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
        // Shared sign-in: allow any https SleepySquid host, so a flow started on sleepysquid.com
        // ends there even though the OAuth callback runs on drones.sleepysquid.com.
        const h = urlObj.hostname;
        if (urlObj.protocol === "https:" && (h === "sleepysquid.com" || h.endsWith(".sleepysquid.com"))) {
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

          const aiIds = await safeActiveClientIds(session.user.email);
          session.user.aiClient = aiIds.length > 0;
          if (session.user.aiClient) session.user.hasAccess = true;

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
  // Shared SleepySquid sign-in: when NEXTAUTH_COOKIE_DOMAIN is set (e.g. ".sleepysquid.com"), every auth
  // cookie (session, state, PKCE, csrf, callback-url) is scoped to that domain so an OAuth flow started on
  // sleepysquid.com can complete on drones.sleepysquid.com. Unset = unchanged host-only defaults.
  ...(process.env.NEXTAUTH_COOKIE_DOMAIN ? (() => {
    const opts = { httpOnly: true, sameSite: "lax", path: "/", secure: true, domain: process.env.NEXTAUTH_COOKIE_DOMAIN };
    return {
      cookies: {
        sessionToken: { name: "__Secure-next-auth.session-token", options: opts },
        callbackUrl: { name: "__Secure-next-auth.callback-url", options: opts },
        // __Host- cookies may not carry a Domain attribute, so the shared csrf cookie uses __Secure-.
        csrfToken: { name: "__Secure-next-auth.csrf-token", options: opts },
        pkceCodeVerifier: { name: "__Secure-next-auth.pkce.code_verifier", options: { ...opts, maxAge: 900 } },
        state: { name: "__Secure-next-auth.state", options: { ...opts, maxAge: 900 } },
        nonce: { name: "__Secure-next-auth.nonce", options: opts },
      },
    };
  })() : {}),
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
