/**
 * State for the Zeitview cancel email that the drone-gigs bot sends.
 * The dashboard only queues the email. The bot sends it from lawmbass1@gmail.com
 * to pilots@dronebase.com and writes back sent or failed with the Gmail id.
 */

export const CANCEL_EMAIL_STUCK_MS = 10 * 60 * 1000;
export const CANCEL_EMAIL_SUBJECT_MAX = 300;
export const CANCEL_EMAIL_BODY_MAX = 5000;

export function cancelEmailMessageKey(listingId, now = new Date()) {
  const ms = new Date(now).getTime();
  const id = String(listingId || "").replace(/[^A-Za-z0-9-]/g, "");
  return `<cancel-${id}-${ms}@drones.sleepysquid.com>`;
}

/**
 * Whether a new send may be queued. An email that is queued, sending, or
 * already sent for the current request blocks a second send. After Undo
 * (cancel status cleared), a new request may send again.
 */
export function cancelEmailBlock(listing) {
  const status = listing?.cancelEmailStatus || null;
  if (status === "queued" || status === "sending") {
    return "The cancellation email is already being sent.";
  }
  if (status === "sent" && listing?.cancelStatus) {
    return "The cancellation email was already sent.";
  }
  return null;
}

/** What the dialog shows for the email: idle, sending, sent, failed, or stuck. */
export function cancelEmailView(listing, now = new Date()) {
  const status = listing?.cancelEmailStatus || null;
  if (status === "sent") {
    return { state: "sent", gmailId: listing.cancelEmailGmailId || null, sentAt: listing.cancelEmailSentAt || null, showDrafts: false, poll: false };
  }
  if (status === "failed") {
    return { state: "failed", error: listing.cancelEmailError || "The email was not sent.", showDrafts: true, poll: false };
  }
  if (status === "queued" || status === "sending") {
    const since = new Date(listing.cancelEmailAttemptedAt || listing.cancelEmailRequestedAt || 0).getTime();
    const stuck = !Number.isFinite(since) || new Date(now).getTime() - since > CANCEL_EMAIL_STUCK_MS;
    if (stuck) {
      return { state: "stuck", error: "The bot has not confirmed the send yet. Check Gmail Sent before sending it yourself.", showDrafts: true, poll: true };
    }
    return { state: "sending", showDrafts: false, poll: true };
  }
  return { state: "idle", showDrafts: false, poll: false };
}

/** Database fields that queue one send. intent is always cancel. */
export function queueCancelEmailFields({ listingId, draft, reason, now = new Date() }) {
  const at = new Date(now).toISOString();
  return {
    cancel_status: "cancel_requested",
    cancel_reason: reason,
    cancel_requested_at: at,
    cancelled_at: null,
    cancel_email_status: "queued",
    cancel_email_subject: draft.subject,
    cancel_email_body: draft.body,
    cancel_email_message_key: cancelEmailMessageKey(listingId, now),
    cancel_email_requested_at: at,
    cancel_email_attempted_at: null,
    cancel_email_sent_at: null,
    cancel_email_gmail_id: null,
    cancel_email_error: null,
  };
}
