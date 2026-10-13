import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";

function rateLimit(req, res) {
  return new Promise((resolve, reject) => {
    adminRateLimit(req, res, (result) => {
      if (result instanceof Error) {
        res.status(429).json({
          error: "Rate limit exceeded",
          message: "Too many admin requests. Please wait before trying again.",
        });
        return reject(result);
      }
      resolve();
    });
  });
}

export async function requireAdmin(req, res, methods) {
  try {
    await rateLimit(req, res);
  } catch {
    return null;
  }

  if (!methods.includes(req.method)) {
    res.status(405).json({
      error: "Method not allowed",
      message: `Only ${methods.join(", ")} requests are allowed`,
    });
    return null;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required. Please sign in.",
    });
    return null;
  }
  if (!adminConfig.isAdmin(session.user.email)) {
    res.status(403).json({
      error: "Forbidden",
      message: "Admin access required. Insufficient permissions.",
    });
    return null;
  }
  return session;
}
