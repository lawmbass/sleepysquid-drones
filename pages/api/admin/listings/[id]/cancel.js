import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { findListingById, queueListingCancelEmail, updateListingCancel } from "@/libs/db/listings";
import { findBookingById, updateBooking } from "@/libs/db/bookings";
import { isUuid } from "@/libs/db/shared";
import { buildCancelDraft, cancelGigVisibility, scheduleForListing } from "@/libs/cancelGig";
import { cancelEmailBlock, queueCancelEmailFields } from "@/libs/cancelEmail";

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

  // "send" queues the cancel email; the drone-gigs bot sends it from
  // lawmbass1@gmail.com to pilots@dronebase.com. This route never sends mail.
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
      booking: linkedBooking,
      bookingStatus: linkedBooking?.status,
    });
    if ((action === "send" || action === "request" || action === "confirm") && !visibility.showCancel) {
      return res.status(400).json({
        error: "Gig completed",
        message: visibility.botAccepted
          ? "This gig is completed, so it can't be cancelled from here"
          : "Cancel gig is only available for a mission the bot accepted that is still pending",
      });
    }
    if (action === "undo" && !visibility.showUndo) {
      return res.status(400).json({
        error: "Gig completed",
        message: "This gig is completed, so the cancellation mark can't be removed",
      });
    }

    if (action === "send") {
      if (req.body?.confirm !== true) {
        return res.status(400).json({ error: "Confirmation required", message: "Confirm before sending the cancellation" });
      }
      const reason = cleanReason(req.body?.reason);
      if (!reason) {
        return res.status(400).json({ error: "Reason required", message: "Enter a reason for cancelling" });
      }
      if (existing.cancelStatus === "cancelled") {
        return res.status(409).json({ error: "Already cancelled", message: "Zeitview already confirmed this cancellation" });
      }
      const blocked = cancelEmailBlock(existing);
      if (blocked) {
        return res.status(409).json({ error: "Already sent", message: blocked, data: { listing: existing } });
      }
      // Built here from stored fields, so the browser cannot change the recipient.
      const draft = buildCancelDraft({
        missionId: existing.externalMissionId,
        address: existing.address,
        schedule: scheduleForListing(existing),
        reason,
      });
      const queued = await queueListingCancelEmail(id, queueCancelEmailFields({ listingId: id, draft, reason }));
      if (!queued) {
        const latest = await findListingById(id);
        return res.status(409).json({
          error: "Already sent",
          message: cancelEmailBlock(latest) || "The listing changed. Reload and try again.",
          data: { listing: latest },
        });
      }
      const listing = await findListingById(id);
      return res.status(202).json({
        success: true,
        message: "Cancellation email queued. The bot sends it within a minute.",
        data: { listing },
      });
    }

    const now = new Date().toISOString();
    let fields;

    if (action === "request") {
      // Manual mark after sending the email yourself (the fallback path).
      const reason = cleanReason(req.body?.reason);
      if (!reason) {
        return res.status(400).json({
          error: "Reason required",
          message: "Enter a reason for cancelling",
        });
      }
      fields = {
        cancelStatus: "cancel_requested",
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
      return res.status(400).json({ error: "Invalid action", message: "Action must be send, request, confirm, or undo" });
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
    listing.bookingAcceptedAt = linkedBooking?.acceptedAt || listing.bookingAcceptedAt || null;
    listing.workComplete = cancelGigVisibility({
      listing,
      booking: linkedBooking ? { ...linkedBooking, status: bookingStatus } : null,
      bookingStatus,
    }).workComplete;

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
