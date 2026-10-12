import { useEffect, useMemo, useState } from "react";
import {
  buildCancelDraft,
  flightWarning,
  flightWarningMessage,
  gmailComposeUrl,
  mailtoUrl,
  scheduleForListing,
} from "@/libs/cancelGig";

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

export function CancelGigButton({ listingId, onUpdated, className = "" }) {
  const [open, setOpen] = useState(false);
  if (!listingId) return null;
  return (
    <>
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
      {open && (
        <CancelGigModal
          listingId={listingId}
          onClose={() => setOpen(false)}
          onUpdated={onUpdated}
        />
      )}
    </>
  );
}

export default function CancelGigModal({ listingId, onClose, onUpdated }) {
  const [listing, setListing] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [intent, setIntent] = useState("cancel");
  const [reason, setReason] = useState("");
  const [draftOpened, setDraftOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/admin/listings/${listingId}`, { credentials: "include" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || "Could not load this gig.");
        if (!cancelled) {
          const next = payload.data?.listing;
          setListing(next);
          if (next?.cancelReason) setReason(next.cancelReason);
          if (next?.cancelStatus === "reschedule_requested") setIntent("reschedule");
        }
      } catch (error) {
        if (!cancelled) setLoadError(error.message);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const schedule = useMemo(() => (listing ? scheduleForListing(listing) : null), [listing]);
  const warning = schedule ? flightWarning(schedule) : { level: "unknown", hoursUntil: null };
  const warningText = flightWarningMessage(warning.level);
  const draft = listing
    ? buildCancelDraft({
      intent,
      missionId: listing.externalMissionId,
      address: listing.address,
      schedule,
      reason,
    })
    : null;
  const reasonReady = reason.trim().length > 0;

  useEffect(() => {
    setDraftOpened(false);
    setCopied(false);
  }, [intent, reason]);

  const mark = async (action) => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/listings/${listingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, intent, reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Could not save the cancellation status.");
      setListing(payload.data.listing);
      setMessage(action === "undo" ? "Cancellation mark removed." : "Saved. No email was sent from the site.");
      if (onUpdated) onUpdated(payload.data.listing);
    } catch (error) {
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cancel gig</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Zeitview has no cancel button. This opens a draft to {listing ? "pilots@dronebase.com" : "DroneBase"} from lawmbass1@gmail.com. The site does not send it.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white" aria-label="Close">
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loadError && <p className="text-sm text-red-600">{loadError}</p>}
          {!listing && !loadError && <p className="text-sm text-gray-500 dark:text-gray-400">Loading gig…</p>}
          {listing && (
            <>
              <div className="flex flex-wrap gap-2">
                <CancelStatusBadge status={listing.cancelStatus} />
              </div>
              {warningText && (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                  {warningText}
                </p>
              )}

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-gray-900 dark:text-white">What should the email ask for?</legend>
                <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                  <input type="radio" name="cancel-intent" checked={intent === "cancel"} onChange={() => setIntent("cancel")} />
                  Cancel the mission
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                  <input type="radio" name="cancel-intent" checked={intent === "reschedule"} onChange={() => setIntent("reschedule")} />
                  Ask to reschedule
                </label>
              </fieldset>

              <label className="block text-sm font-medium text-gray-900 dark:text-white">
                Reason
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  placeholder="Weather, schedule conflict, site access…"
                />
              </label>

              {draft && (
                <div className="rounded-md bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-800 dark:text-gray-100">
                  <p><span className="text-gray-500 dark:text-gray-400">To:</span> {draft.to}</p>
                  <p className="mt-1"><span className="text-gray-500 dark:text-gray-400">Subject:</span> {draft.subject}</p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans">{draft.body}</pre>
                </div>
              )}

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

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                <button
                  type="button"
                  disabled={!draftOpened || !reasonReady || saving}
                  onClick={() => mark("request")}
                  className="w-full px-3 py-2 rounded-md bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  {intent === "reschedule" ? "Mark reschedule requested" : "Mark cancel requested"}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Use this after the draft is open. It only saves a note on the listing.
                </p>
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
