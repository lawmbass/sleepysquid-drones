import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { findListingById, softDeleteListing, updateListingNotes } from "@/libs/db/listings";
import { canMarkCompleted, canUnmarkCompleted, listingDeleteState, withCompletedTag } from "@/libs/listingLifecycle";
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

  if (req.method !== "GET" && req.method !== "PATCH" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed", message: "Only GET, PATCH and DELETE requests are allowed" });
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

    if (req.method === "DELETE") {
      // Soft delete. Accepted or completed gigs must be cancelled first.
      const state = listingDeleteState(existing);
      if (!state.canDelete) {
        return res.status(409).json({ error: "Cannot delete listing", reason: state.reason, message: state.message });
      }
      const deleted = await softDeleteListing(id, { deletedBy: session.user.email });
      if (!deleted) {
        return res.status(409).json({
          error: "Cannot delete listing",
          reason: "changed",
          message: "This listing changed while you were deleting it. Reload and try again.",
        });
      }
      return res.status(200).json({ success: true, message: "Listing deleted", data: { id, deletedAt: deleted.deleted_at } });
    }

    if (existing.deletedAt) {
      return res.status(409).json({ error: "Listing deleted", message: "Restore this listing before editing it" });
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
    if (req.body?.completed !== undefined) {
      if (typeof req.body.completed !== "boolean") {
        return res.status(400).json({ error: "Invalid completed flag", message: "completed must be true or false" });
      }
      if (req.body.completed && !canMarkCompleted(existing)) {
        return res.status(400).json({ error: "Cannot mark completed", message: "Only an accepted gig that is not cancelled or already completed can be marked completed" });
      }
      if (!req.body.completed && !canUnmarkCompleted(existing)) {
        return res.status(400).json({ error: "Cannot unmark completed", message: "This listing was not marked completed by hand" });
      }
      updates.tags = withCompletedTag(updates.tags ?? existing.tags, req.body.completed);
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updates provided", message: "Provide admin notes, tags, or completed" });
    }

    await updateListingNotes(id, updates);
    const listing = await findListingById(id);
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
