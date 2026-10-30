import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildCancelDraft,
  cancelGigVisibility,
  flightWarning,
  flightWarningMessage,
  gmailComposeUrl,
  mailtoUrl,
  GMAIL_ACCOUNT,
  PILOT_EMAIL,
  scheduleForListing,
} from "@/libs/cancelGig";
import { cancelEmailView } from "@/libs/cancelEmail";
import { gigCardState } from "@/libs/jobs";

const BADGE_STYLES = {
  cancel_requested: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  reschedule_requested: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
};

const BADGE_LABELS = {
  cancel_requested: "Cancel requested",
  reschedule_requested: "Reschedule requested",
  cancelled: "Cancelled",
};

export function CancelStatusBadge({ status }) {
  if (!status || !BADGE_LABELS[status]) return null;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[status]}`}>
      {BADGE_LABELS[status]}
    </span>
  );
}

export function CancelGigButton({
  listingId,
  listing,
  job,
  booking,
  bookingStatus,
  bookingAcceptedAt,
  unlinkedListing,
  workComplete,
  onUpdated,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const id = listingId || listing?.id || job?.listingId || (job?.unlinkedListing ? job?.id : null);
  const actions = gigCardState({
    listing,
    job,
    booking: booking || (bookingStatus || bookingAcceptedAt || listing?.bookingStatus || listing?.bookingAcceptedAt
      ? {
        status: bookingStatus || listing?.bookingStatus,
        acceptedAt: bookingAcceptedAt || listing?.bookingAcceptedAt,
      }
      : null),
    bookingStatus: bookingStatus || listing?.bookingStatus,
    unlinkedListing: unlinkedListing ?? job?.unlinkedListing,
    workComplete: workComplete ?? job?.workComplete,
  });
  if (!id || (!actions.showCancel && !actions.showUndo)) return null;
  return (
    <>
      {actions.showCancel && (
        <button
          type="button"
          className={`inline-flex items-center rounded-md border border-red-300 dark:border-red-700 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/30 ${className}`}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
        >
          Cancel gig
        </button>
      )}
      {actions.showUndo && !actions.showCancel && (
        <button
          type="button"
          className={`inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 ${className}`}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
        >
          Undo
        </button>
      )}
      {open && (
        <CancelGigModal
          listingId={id}
          onClose={() => setOpen(false)}
          onUpdated={onUpdated}
        />
      )}
    </>
  );
}

export function formatSentEt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)} ET`;
}

const POLL_MS = 5000;

export default function CancelGigModal({ listingId, onClose, onUpdated, now: nowOverride }) {
  const [listing, setListing] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [draftOpened, setDraftOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);

  const loadListing = useCallback(async () => {
    const response = await fetch(`/api/admin/listings/${listingId}`, { credentials: "include" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Could not load this gig.");
    return payload.data?.listing;
  }, [listingId]);

  useEffect(() => {
    let cancelled = false;
    loadListing()
      .then((next) => {
        if (cancelled) return;
        setListing(next);
        if (next?.cancelReason) setReason(next.cancelReason);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [loadListing]);

  const now = nowOverride || new Date();
  const emailView = cancelEmailView(listing, now);

  // While the bot is sending, re-read the listing until it reports sent or failed.
  useEffect(() => {
    if (!emailView.poll) return undefined;
    const timer = setTimeout(async () => {
      try {
        const next = await loadListing();
        if (next) {
          setListing(next);
          if (next.cancelEmailStatus === "sent" && onUpdated) onUpdated(next);
        }
      } catch (error) {
        // Keep the last known state; the next tick tries again.
      }
      setTick((value) => value + 1);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [emailView.poll, emailView.state, tick, loadListing, onUpdated]);

  const schedule = useMemo(() => (listing ? scheduleForListing(listing) : null), [listing]);
  const warning = schedule ? flightWarning(schedule) : { level: "unknown", hoursUntil: null };
  const warningText = flightWarningMessage(warning.level);
  const emailOpen = emailView.state === "sending" || emailView.state === "stuck" || emailView.state === "sent";
  const shownSubject = emailOpen && listing?.cancelEmailSubject;
  const draft = listing
    ? (shownSubject
      ? { to: PILOT_EMAIL, subject: listing.cancelEmailSubject, body: listing.cancelEmailBody, fromAccount: GMAIL_ACCOUNT }
      : buildCancelDraft({
        missionId: listing.externalMissionId,
        address: listing.address,
        schedule,
        reason,
      }))
    : null;
  const reasonReady = reason.trim().length > 0;
  const actions = listing
    ? cancelGigVisibility({
      listing,
      booking: listing.bookingId
        ? { id: listing.bookingId, status: listing.bookingStatus, acceptedAt: listing.bookingAcceptedAt }
        : null,
      bookingStatus: listing.bookingStatus,
    })
    : { showCancel: false, showUndo: false, workComplete: false };
  const canSend = actions.showCancel && !emailOpen && listing?.cancelStatus !== "cancelled";

  useEffect(() => {
    setDraftOpened(false);
    setCopied(false);
    setConfirming(false);
  }, [reason]);

  const post = async (body) => {
    const response = await fetch(`/api/admin/listings/${listingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (payload?.data?.listing) setListing(payload.data.listing);
    if (!response.ok) throw new Error(payload.message || "Could not save the cancellation status.");
    return payload.data.listing;
  };

  const mark = async (action) => {
    setSaving(true);
    setMessage("");
    try {
      const next = await post({ action, reason });
      setMessage(action === "undo" ? "Cancellation mark removed." : "Saved on the listing.");
      if (onUpdated) onUpdated(next);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const sendCancellation = async () => {
    if (!reasonReady || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const next = await post({ action: "send", confirm: true, reason });
      setConfirming(false);
      if (onUpdated) onUpdated(next);
    } catch (error) {
      setConfirming(false);
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const openGmail = () => {
    if (!draft || !reasonReady) return;
    window.open(gmailComposeUrl(draft), "_blank", "noopener,noreferrer");
    setDraftOpened(true);
  };

  const openMailto = () => {
    if (!draft || !reasonReady) return;
    window.location.href = mailtoUrl(draft);
    setDraftOpened(true);
  };

  const copyEmail = async () => {
    if (!draft || !reasonReady) return;
    const text = `To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setDraftOpened(true);
    } catch (error) {
      setMessage("Could not copy. Select the email text below and copy it yourself.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {listing && !actions.showCancel ? (actions.showUndo ? "Undo cancel" : "Gig completed") : "Cancel gig"}
            </h2>
            {(!listing || actions.showCancel) && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Zeitview has no cancel button. Send cancellation emails {PILOT_EMAIL} for you from {GMAIL_ACCOUNT}.
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white" aria-label="Close">
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loadError && <p className="text-sm text-red-600">{loadError}</p>}
          {!listing && !loadError && <p className="text-sm text-gray-500 dark:text-gray-400">Loading gig…</p>}
          {listing && !actions.showCancel && !actions.showUndo && (
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Cancel gig is closed for this mission.
            </p>
          )}
          {listing && actions.showUndo && !actions.showCancel && (
            <div className="space-y-3">
              <CancelStatusBadge status={listing.cancelStatus} />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                The cancellation mark is still on this gig. Undo removes it. Undo does not email Zeitview.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => mark("undo")}
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 disabled:opacity-50"
              >
                Undo
              </button>
              {message && <p className="text-sm text-gray-700 dark:text-gray-200">{message}</p>}
            </div>
          )}
          {listing && actions.showCancel && (
            <>
              <div className="flex flex-wrap gap-2">
                <CancelStatusBadge status={listing.cancelStatus} />
              </div>
              {warningText && !emailOpen && (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                  {warningText}
                </p>
              )}

              {emailView.state === "sent" && (
                <div role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-700 dark:bg-green-900/30 dark:text-green-100">
                  <p className="font-medium">Cancellation sent to {PILOT_EMAIL}{listing.cancelEmailSentAt ? ` at ${formatSentEt(listing.cancelEmailSentAt)}` : ""}.</p>
                  {emailView.gmailId && <p className="mt-1 text-xs">Gmail message id: <span className="font-mono">{emailView.gmailId}</span></p>}
                  <p className="mt-1 text-xs">Mark it cancelled once Zeitview confirms.</p>
                </div>
              )}
              {emailView.state === "sending" && (
                <div role="status" className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-100">
                  <p className="font-medium">Sending… the bot sends it within a minute.</p>
                  <p className="mt-1 text-xs">You can close this window. The status updates here when Gmail confirms.</p>
                </div>
              )}
              {(emailView.state === "failed" || emailView.state === "stuck") && (
                <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100">
                  <p className="font-medium">{emailView.state === "failed" ? "The cancellation email was not sent." : "Still waiting on the bot."}</p>
                  <p className="mt-1 text-xs">{emailView.error}</p>
                  <p className="mt-1 text-xs">Send it yourself with the buttons below{emailView.state === "failed" ? ", or try Send cancellation again" : ""}.</p>
                </div>
              )}

              <label className="block text-sm font-medium text-gray-900 dark:text-white">
                Reason
                <textarea
                  rows={3}
                  required
                  value={reason}
                  disabled={emailOpen}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white disabled:opacity-60"
                  placeholder="Weather, schedule conflict, site access…"
                />
              </label>

              {draft && (
                <div className="rounded-md bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-800 dark:text-gray-100">
                  <p><span className="text-gray-500 dark:text-gray-400">From:</span> {GMAIL_ACCOUNT}</p>
                  <p className="mt-1"><span className="text-gray-500 dark:text-gray-400">To:</span> {draft.to}</p>
                  <p className="mt-1"><span className="text-gray-500 dark:text-gray-400">Subject:</span> {draft.subject}</p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans">{draft.body}</pre>
                </div>
              )}

              {canSend && !confirming && (
                <button
                  type="button"
                  disabled={!reasonReady || saving}
                  onClick={() => setConfirming(true)}
                  className="w-full px-3 py-2 rounded-md bg-red-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  Send cancellation
                </button>
              )}
              {canSend && confirming && (
                <div className="rounded-md border border-red-300 dark:border-red-700 p-3 space-y-3">
                  <p className="text-sm text-gray-900 dark:text-white">
                    Send this email to {PILOT_EMAIL} from {GMAIL_ACCOUNT} now? It can&apos;t be unsent.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!reasonReady || saving}
                      onClick={sendCancellation}
                      className="flex-1 px-3 py-2 rounded-md bg-red-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {saving ? "Sending…" : "Send cancellation"}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setConfirming(false)}
                      className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 disabled:opacity-50"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {emailView.showDrafts && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!reasonReady} onClick={openGmail} className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
                      Open in Gmail
                    </button>
                    <button type="button" disabled={!reasonReady} onClick={openMailto} className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 disabled:opacity-50">
                      Mail app
                    </button>
                    <button type="button" disabled={!reasonReady} onClick={copyEmail} className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 disabled:opacity-50">
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  {emailView.state === "failed" && !listing.cancelStatus && (
                    <button
                      type="button"
                      disabled={!draftOpened || !reasonReady || saving}
                      onClick={() => mark("request")}
                      className="w-full px-3 py-2 rounded-md bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      Mark cancel requested
                    </button>
                  )}
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                <button
                  type="button"
                  disabled={!reasonReady || saving || listing.cancelStatus === "cancelled"}
                  onClick={() => mark("confirm")}
                  className="w-full px-3 py-2 rounded-md border border-red-300 text-sm text-red-700 dark:text-red-200 disabled:opacity-50"
                >
                  Mark cancelled (Zeitview confirmed)
                </button>
                {listing.cancelStatus && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => mark("undo")}
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100 disabled:opacity-50"
                  >
                    Undo
                  </button>
                )}
              </div>
              {message && <p className="text-sm text-gray-700 dark:text-gray-200">{message}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
