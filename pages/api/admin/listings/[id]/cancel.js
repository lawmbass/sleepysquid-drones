import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { findListingById, updateListingCancel } from "@/libs/db/listings";
import { findBookingById, updateBooking } from "@/libs/db/bookings";
import { isUuid } from "@/libs/db/shared";
import { cancelGigVisibility } from "@/libs/cancelGig";
import { bookingWorkComplete, listingWorkComplete } from "@/libs/gigComplete";
import { scheduledFlightLongPast } from "@/libs/jobs";

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

function cleanReason(value) {
  if (typeof value !== "string") return null;
  const reason = value.replace(/<[^>]*>/g, "").trim();
  if (!reason || reason.length > 2000) return null;
  return reason;
}

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

  // This route only records the pilot's request. It does not send email.
  try {
    const existing = await findListingById(id);
    if (!existing) {
      return res.status(404).json({ error: "Listing not found", message: "The specified mission listing does not exist" });
    }
    if (existing.status !== "accepted") {
      return res.status(400).json({ error: "Not an accepted gig", message: "Only accepted listings can be cancelled" });
    }

    const action = req.body?.action;
    const linkedBooking = existing.bookingId ? await findBookingById(existing.bookingId) : null;
    const visibility = cancelGigVisibility({
      listing: existing,
      bookingStatus: linkedBooking?.status,
    });
    if ((action === "request" || action === "confirm") && !visibility.showCancel) {
      return res.status(400).json({
        error: "Gig completed",
        message: "This gig is completed, so it can't be cancelled from here",
      });
    }
    if (action === "undo" && !visibility.showUndo) {
      return res.status(400).json({
        error: "Gig completed",
        message: "This gig is completed, so the cancellation mark can't be removed",
      });
    }

    const now = new Date().toISOString();
    let fields;

    if (action === "request") {
      const intent = req.body?.intent === "reschedule" ? "reschedule" : req.body?.intent === "cancel" ? "cancel" : null;
      const reason = cleanReason(req.body?.reason);
      if (!intent || !reason) {
        return res.status(400).json({
          error: "Reason required",
          message: "Choose cancel or reschedule and enter a reason",
        });
      }
      fields = {
        cancelStatus: intent === "reschedule" ? "reschedule_requested" : "cancel_requested",
        cancelReason: reason,
        cancelRequestedAt: now,
        cancelledAt: null,
      };
    } else if (action === "confirm") {
      const reason = cleanReason(req.body?.reason) || cleanReason(existing.cancelReason);
      if (!reason) {
        return res.status(400).json({
          error: "Reason required",
          message: "Enter the reason before marking the gig cancelled",
        });
      }
      fields = {
        cancelStatus: "cancelled",
        cancelReason: reason,
        cancelRequestedAt: existing.cancelRequestedAt || now,
        cancelledAt: now,
      };
    } else if (action === "undo") {
      fields = {
        cancelStatus: null,
        cancelReason: null,
        cancelRequestedAt: null,
        cancelledAt: null,
      };
    } else {
      return res.status(400).json({ error: "Invalid action", message: "Action must be request, confirm, or undo" });
    }

    const listing = await updateListingCancel(id, fields);

    let bookingStatus = linkedBooking?.status || null;
    if (existing.bookingId && (action === "confirm" || action === "undo") && linkedBooking) {
      if (action === "confirm" && linkedBooking.status !== "cancelled") {
        await updateBooking(linkedBooking.id, { status: "cancelled" });
        bookingStatus = "cancelled";
      }
      if (action === "undo" && linkedBooking.status === "cancelled") {
        await updateBooking(linkedBooking.id, { status: "confirmed" });
        bookingStatus = "confirmed";
      }
    }
    listing.bookingStatus = bookingStatus;
    listing.workComplete = listingWorkComplete(listing)
      || scheduledFlightLongPast(listing)
      || bookingWorkComplete(bookingStatus);

    return res.status(200).json({
      success: true,
      message: "Cancellation status saved",
      data: { listing },
    });
  } catch (error) {
    console.error("Admin listing cancel error:", error);
    return res.status(500).json({ error: "Internal server error", message: "Failed to update cancellation status" });
  }
}
