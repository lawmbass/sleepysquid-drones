import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { findListingById, restoreListing } from "@/libs/db/listings";
import { isUuid } from "@/libs/db/shared";

const rateLimitMiddleware = (req, res) => {
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
};

// Undo a soft delete. The row was never removed, so this only clears deleted_at.
export default async function handler(req, res) {
  try {
    await rateLimitMiddleware(req, res);
  } catch (error) {
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", message: "Only POST requests are allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized", message: "Authentication required. Please sign in." });
  }
  if (!adminConfig.isAdmin(session.user.email)) {
    return res.status(403).json({ error: "Forbidden", message: "Admin access required. Insufficient permissions." });
  }

  const { id } = req.query;
  if (!isUuid(id)) {
    return res.status(400).json({ error: "Invalid listing ID", message: "The provided listing ID is not valid" });
  }

  try {
    const existing = await findListingById(id);
    if (!existing) {
      return res.status(404).json({ error: "Listing not found", message: "The specified mission listing does not exist" });
    }
    if (!existing.deletedAt) {
      return res.status(409).json({ error: "Not deleted", message: "This listing is not deleted" });
    }
    await restoreListing(id);
    const listing = await findListingById(id);
    return res.status(200).json({ success: true, message: "Listing restored", data: { listing } });
  } catch (error) {
    console.error("Admin listing restore error:", error);
    return res.status(500).json({ error: "Internal server error", message: "Failed to restore mission listing" });
  }
}
