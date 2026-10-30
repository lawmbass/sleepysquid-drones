import { useState } from "react";
import { FiCheckCircle, FiLock, FiRotateCcw, FiTrash2 } from "react-icons/fi";
import ConfirmationDialog from "./ConfirmationDialog";
import { canMarkCompleted, canUnmarkCompleted, listingDeleteState } from "@/libs/listingLifecycle";

function listingName(listing) {
  return listing?.clientName || listing?.title || listing?.externalMissionId || "this listing";
}

async function send(url, options) {
  const response = await fetch(url, { credentials: "include", ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "Request failed.");
  return payload;
}

/**
 * Delete with a confirm step. The server repeats the same rule, so a hidden
 * or stale button can never delete an accepted or completed gig.
 * compact: icon button for list cards; blocked listings show nothing there.
 */
export function DeleteListingButton({ listing, compact = false, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!listing || listing.deletedAt) return null;
  const state = listing.deleteState || listingDeleteState(listing);

  if (!state.canDelete && compact) return null;

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await send(`/api/admin/listings/${listing.id}`, { method: "DELETE" });
      setConfirming(false);
      onDeleted?.(listing);
    } catch (deleteError) {
      setError(deleteError.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const button = compact ? (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setConfirming(true);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-red-200 dark:border-red-800 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
    >
      <FiTrash2 className="h-3.5 w-3.5" /> Delete
    </button>
  ) : (
    <button
      type="button"
      disabled={!state.canDelete}
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-2 rounded-md border border-red-300 dark:border-red-700 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-transparent dark:disabled:border-gray-700 dark:disabled:text-gray-500"
    >
      {state.canDelete ? <FiTrash2 className="h-4 w-4" /> : <FiLock className="h-4 w-4" />}
      Delete listing
    </button>
  );

  return (
    <div onClick={(event) => event.stopPropagation()}>
      {button}
      {!compact && !state.canDelete && state.message && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{state.message}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <ConfirmationDialog
        isOpen={confirming}
        title="Delete this listing?"
        message={`${listingName(listing)} will be hidden from the dashboard. The bot will not import it again, and you can restore it from the Deleted filter.`}
        confirmText="Delete"
        isLoading={busy}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

export function RestoreListingButton({ listing, onRestored }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!listing?.deletedAt) return null;
  const restore = async () => {
    setBusy(true);
    setError("");
    try {
      const payload = await send(`/api/admin/listings/${listing.id}/restore`, { method: "POST" });
      onRestored?.(payload.data?.listing);
    } catch (restoreError) {
      setError(restoreError.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button
        type="button"
        onClick={restore}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
      >
        <FiRotateCcw className="h-4 w-4" /> {busy ? "Restoring…" : "Restore listing"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function MarkCompletedButton({ listing, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mark = canMarkCompleted(listing);
  const unmark = canUnmarkCompleted(listing);
  if (!mark && !unmark) return null;
  const update = async () => {
    setBusy(true);
    setError("");
    try {
      const payload = await send(`/api/admin/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: mark }),
      });
      onUpdated?.(payload.data?.listing);
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button
        type="button"
        onClick={update}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
      >
        <FiCheckCircle className="h-4 w-4" /> {busy ? "Saving…" : mark ? "Mark completed" : "Not completed"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** Detail-modal section: complete, delete, or restore. */
export function ListingManageSection({ listing, onChanged, onDeleted }) {
  if (!listing) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Manage listing</h3>
      {listing.deletedAt ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Deleted {new Date(listing.deletedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            {listing.deletedBy ? ` by ${listing.deletedBy}` : ""}. The bot still sees it, so it is not imported again.
          </p>
          <RestoreListingButton listing={listing} onRestored={onChanged} />
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <MarkCompletedButton listing={listing} onUpdated={onChanged} />
          <DeleteListingButton listing={listing} onDeleted={onDeleted} />
        </div>
      )}
    </section>
  );
}
