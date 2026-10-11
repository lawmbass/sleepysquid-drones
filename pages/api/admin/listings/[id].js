import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { findListingById, updateListingNotes } from "@/libs/db/listings";
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

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return null;
  const cleaned = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const value = tag.trim().replace(/<[^>]*>/g, "");
    if (!value || value.length > 60) continue;
    if (!cleaned.includes(value)) cleaned.push(value);
    if (cleaned.length >= 20) break;
  }
  return cleaned;
}

export default async function handler(req, res) {
  try {
    await rateLimitMiddleware(req, res);
  } catch (error) {
    return;
  }

  if (req.method !== "GET" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed", message: "Only GET and PATCH requests are allowed" });
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

    if (req.method === "GET") {
      return res.status(200).json({ success: true, data: { listing: existing } });
    }

    const updates = {};
    if (req.body?.adminNotes !== undefined) {
      if (typeof req.body.adminNotes !== "string" || req.body.adminNotes.length > 2000) {
        return res.status(400).json({
          error: "Invalid admin notes",
          message: "Admin notes must be a string of at most 2000 characters",
        });
      }
      updates.adminNotes = req.body.adminNotes.trim();
    }
    if (req.body?.tags !== undefined) {
      const tags = normalizeTags(req.body.tags);
      if (!tags) {
        return res.status(400).json({ error: "Invalid tags", message: "Tags must be an array of strings" });
      }
      updates.tags = tags;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updates provided", message: "Provide admin notes or tags" });
    }

    const listing = await updateListingNotes(id, updates);
    return res.status(200).json({
      success: true,
      message: "Listing updated",
      data: { listing },
    });
  } catch (error) {
    console.error("Admin listing update error:", error);
    return res.status(500).json({ error: "Internal server error", message: "Failed to update mission listing" });
  }
}
