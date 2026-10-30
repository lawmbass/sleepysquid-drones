import { useCallback, useEffect, useState } from "react";
import {
  FiMapPin,
  FiClock,
  FiDollarSign,
  FiTag,
  FiCheck,
  FiX,
} from "react-icons/fi";
import { CancelGigButton, CancelStatusBadge } from "./CancelGigModal";
import { DeleteListingButton, ListingManageSection } from "./ListingDeleteControls";
import { dedupeEquipment, formatItems } from "@/libs/listingSpecs";
import {
  SOURCE_FILTERS,
  isSparseListing,
  listingMessageText,
  missionPageUrl,
  sourceBadgeClass,
  sourceCounts,
  sourceLabel,
} from "@/libs/listingSources";

function SourceBadge({ source }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sourceBadgeClass(source)}`}>
      {sourceLabel(source)}
    </span>
  );
}

function MissionTypeText({ listing }) {
  if (!listing?.missionType) return <span className="text-gray-400">—</span>;
  return (
    <span title={listing.missionTypeDerived ? "Guessed from the listing text" : undefined}>
      {listing.missionType}
      {listing.missionTypeDerived && <span className="text-gray-400">*</span>}
    </span>
  );
}

// Second line under the title: address, else the message text, else nothing.
function ListingSubline({ listing }) {
  const address = listingAddress(listing);
  if (address) return <span>{address}</span>;
  if (listing.messagePreview) return <span className="italic line-clamp-2">“{listing.messagePreview}”</span>;
  return null;
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "seen", label: "Seen" },
  { value: "needs_review", label: "Needs review" },
  { value: "accepted", label: "Accepted" },
  { value: "declined_by_filter", label: "Declined by filter" },
  { value: "expired", label: "Expired" },
  { value: "unavailable", label: "Unavailable" },
  { value: "deleted", label: "Deleted" },
];

const STATUS_STYLES = {
  needs_review: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  seen: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  declined_by_filter: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  expired: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  unavailable: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
};

// Badge status: "completed" for a finished accepted gig, else the stored status.
function shownStatus(listing) {
  return listing?.lifecycleStatus || listing?.status;
}

const SHOT_LABELS = {
  photo: "Photo",
  video: "Video",
  orbit: "Orbit",
  panorama: "Panorama",
  "grid/mapping": "Grid / mapping",
};

function statusLabel(status) {
  if (status === "completed") return "Completed";
  return STATUS_OPTIONS.find((option) => option.value === status)?.label || status || "Unknown";
}

function money(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function labelList(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      return item.name || item.label || item.type || JSON.stringify(item);
    }
    return String(item);
  });
}

function SpecList({ items, empty }) {
  const { chips, blocks } = formatItems(items);
  if (chips.length === 0 && blocks.length === 0) {
    return <span className="text-sm text-gray-500 dark:text-gray-400">{empty}</span>;
  }
  return (
    <div className="space-y-3">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((label) => (
            <span
              key={label}
              className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs font-medium text-gray-800 dark:text-gray-100"
            >
              {label}
            </span>
          ))}
        </div>
      )}
      {blocks.map((bullets, i) => (
        <ul
          key={i}
          className="list-disc space-y-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 py-3 pl-8 pr-4 text-sm leading-relaxed text-gray-700 dark:text-gray-200 break-words"
        >
          {bullets.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ))}
    </div>
  );
}

const NOT_FOUND_TITLE = /^(?:404\b.*|not\s*found|page\s*not\s*found)$/i;
const PAYOUT_PREFIX = /^\$?\s*\d[\d,]*(?:\.\d+)?\s*USD\s*(?:LOCATION|Address)?\s*:?\s*/i;

// Title shown for a listing; a stored "Not Found" page title falls back to the mission id.
export function listingTitle(listing) {
  const title = String(listing?.title || "").trim();
  if (/^sms:/i.test(title) || (!title && /^sms:/i.test(String(listing?.externalMissionId || "")))) return `${sourceLabel(listing?.source)} text message`;
  if (!title || NOT_FOUND_TITLE.test(title)) return listing?.externalMissionId || "Mission listing";
  return title;
}

// Address without an email "90 USD LOCATION" prefix.
export function listingAddress(listing) {
  const address = String(listing?.address || "").trim();
  return address.replace(PAYOUT_PREFIX, "").trim() || null;
}

// True when the bot could not read the mission page.
export function detailsUnavailable(listing) {
  if (!listing) return false;
  if (listing.rawDetail?.detail_status === "unavailable") return true;
  return NOT_FOUND_TITLE.test(String(listing.title || "").trim());
}

function AggregateCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function CountList({ counts }) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No data yet.</p>;
  }
  return (
    <ul className="space-y-1">
      {entries.slice(0, 6).map(([name, count]) => (
        <li key={name} className="flex justify-between text-sm text-gray-800 dark:text-gray-100">
          <span className="truncate pr-3">{statusLabel(name)}</span>
          <span className="font-medium">{count}</span>
        </li>
      ))}
    </ul>
  );
}

const RULE_CHECK_STYLES = {
  pass: "bg-green-50 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  fail: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  review: "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  error: "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200",
};

function RuleCheckBadge({ check }) {
  if (!check) return null;
  return (
    <span
      title={check.reasons.join("; ") || undefined}
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${RULE_CHECK_STYLES[check.state] || RULE_CHECK_STYLES.fail}`}
    >
      {check.label}
    </span>
  );
}

function RuleCheckSection({ check }) {
  if (!check) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Bot rules check</h3>
      <div className="flex items-center gap-2 mb-1">
        <RuleCheckBadge check={check} />
        <span className="text-xs text-gray-500 dark:text-gray-400">Preview only. The bot does not accept this source.</span>
      </div>
      {check.reasons.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-200 space-y-0.5">
          {check.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      )}
    </section>
  );
}

export default function ListingsSection() {
  const [filters, setFilters] = useState({
    source: "",
    status: "",
    mission_type: "",
    equipment: "",
    payout_min: "",
    distance_max: "",
    date_from: "",
    date_to: "",
    search: "",
    sort: "-lastSeenAt",
    page: 1,
  });
  const [listings, setListings] = useState([]);
  const [aggregates, setAggregates] = useState(null);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== "" && value != null) params.append(key, value);
      });
      const response = await fetch(`/api/admin/listings?${params}`, { credentials: "include" });
      if (response.status === 401) {
        throw new Error("Sign in is required.");
      }
      if (!response.ok) {
        throw new Error("Failed to load listings.");
      }
      const payload = await response.json();
      const data = payload.data || {};
      setListings(data.listings || []);
      setAggregates(data.aggregates || null);
      setPagination(data.pagination || {});
    } catch (fetchError) {
      setError(fetchError.message || "Failed to load listings.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const openDetail = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setSaveMessage("");
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/listings/${id}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load listing.");
      const payload = await response.json();
      const listing = payload.data?.listing;
      setDetail(listing);
      setNotes(listing?.adminNotes || "");
      setTags(Array.isArray(listing?.tags) ? listing.tags : []);
    } catch (detailError) {
      setSaveMessage(detailError.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveNotes = async () => {
    if (!selectedId) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch(`/api/admin/listings/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ adminNotes: notes, tags }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Could not save notes.");
      }
      setDetail(payload.data.listing);
      setSaveMessage("Saved.");
      fetchListings();
    } catch (saveError) {
      setSaveMessage(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const value = tagInput.trim();
    if (!value || tags.includes(value)) {
      setTagInput("");
      return;
    }
    setTags([...tags, value]);
    setTagInput("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mission listings</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Every gig the bot picks up from Zeitview, FlyGuys texts and Droners, including ones it declines. Use this to tune acceptance rules and read the details of each job.
        </p>
      </div>

      {aggregates && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AggregateCard title="By mission type">
            <CountList counts={aggregates.byType} />
          </AggregateCard>
          <AggregateCard title="Payout range">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {money(aggregates.payout?.min)} – {money(aggregates.payout?.max)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Average {money(aggregates.payout?.avg)} across {aggregates.payout?.count || 0} priced listings. {aggregates.total || 0} total in this filter.
            </p>
          </AggregateCard>
          <AggregateCard title="Status and decline reasons">
            <CountList counts={aggregates.byStatus} />
            {Object.keys(aggregates.byDeclineReason || {}).length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Decline reasons</p>
                <CountList counts={aggregates.byDeclineReason} />
              </div>
            )}
          </AggregateCard>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Filter by source">
        {SOURCE_FILTERS.map((option) => {
          const counts = sourceCounts(aggregates?.bySource);
          const active = filters.source === option.value;
          return (
            <button
              key={option.value || "all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilters((prev) => ({ ...prev, source: option.value, page: 1 }))}
              className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
              }`}
            >
              {option.label}
              <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/20" : "bg-gray-100 dark:bg-gray-700"}`}>
                {aggregates ? counts[option.value] || 0 : "…"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <input
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
          placeholder="Search title, address, id"
          value={filters.search}
          onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
        />
        <select
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
          value={filters.status}
          onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }))}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>{option.label}</option>
          ))}
        </select>
        <input
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
          placeholder="Mission type"
          value={filters.mission_type}
          onChange={(event) => setFilters((prev) => ({ ...prev, mission_type: event.target.value, page: 1 }))}
        />
        <input
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
          placeholder="Equipment or certification"
          value={filters.equipment}
          onChange={(event) => setFilters((prev) => ({ ...prev, equipment: event.target.value, page: 1 }))}
        />
        <input
          type="number"
          min="0"
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
          placeholder="Min payout"
          value={filters.payout_min}
          onChange={(event) => setFilters((prev) => ({ ...prev, payout_min: event.target.value, page: 1 }))}
        />
        <input
          type="number"
          min="0"
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
          placeholder="Max distance (miles)"
          value={filters.distance_max}
          onChange={(event) => setFilters((prev) => ({ ...prev, distance_max: event.target.value, page: 1 }))}
        />
        <input
          type="date"
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
          value={filters.date_from}
          onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value, page: 1 }))}
          aria-label="Deadline from"
        />
        <select
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
          value={filters.sort}
          onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value, page: 1 }))}
        >
          <option value="-lastSeenAt">Newest seen</option>
          <option value="-payout">Payout high to low</option>
          <option value="payout">Payout low to high</option>
          <option value="travelDistance">Nearest first</option>
          <option value="-travelDistance">Farthest first</option>
          <option value="deadline">Deadline soonest</option>
          <option value="missionType">Mission type</option>
          <option value="status">Status</option>
        </select>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading listings…</p>
        ) : listings.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            {filters.source ? `No ${sourceLabel(filters.source)} listings match these filters.` : "No mission listings match these filters yet. Every gig the bot sees from any source shows up here."}
          </p>
        ) : (
          <>
          <ul className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
            {listings.map((listing) => (
              <li key={listing.id} className="p-4 active:bg-gray-50 dark:active:bg-gray-700/40" onClick={() => openDetail(listing.id)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <SourceBadge source={listing.source} />
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[shownStatus(listing)] || STATUS_STYLES.seen}`}>
                    {statusLabel(shownStatus(listing))}
                  </span>
                  <CancelStatusBadge status={listing.cancelStatus} />
                  <span className="ml-auto text-sm font-semibold text-gray-900 dark:text-white">{listing.payout != null ? money(listing.payout) : ""}</span>
                </div>
                <div className="mt-2 font-medium text-gray-900 dark:text-white break-words">{listingTitle(listing)}</div>
                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 break-words"><ListingSubline listing={listing} /></div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                  {listing.missionType && <span><MissionTypeText listing={listing} /></span>}
                  {listing.travelDistance != null && <span>{listing.travelDistance} mi</span>}
                  {(listing.deadline || listing.dueWindowStart)
                    ? <span>Due {formatWhen(listing.deadline || listing.dueWindowStart)}</span>
                    : <span>Received {formatWhen(listing.receivedAt || listing.firstSeenAt)}</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                  <CancelGigButton
                    listingId={listing.id}
                    listing={listing}
                    bookingStatus={listing.bookingStatus}
                    bookingAcceptedAt={listing.bookingAcceptedAt}
                    workComplete={listing.workComplete}
                    onUpdated={() => fetchListings()}
                  />
                  <DeleteListingButton compact listing={listing} onDeleted={() => fetchListings()} />
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  {["Mission", "Source", "Status", "Type", "Payout", "Distance", "Equipment", "Deadline / received"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {listings.map((listing) => (
                  <tr
                    key={listing.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer"
                    onClick={() => openDetail(listing.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{listingTitle(listing)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 max-w-md"><ListingSubline listing={listing} /></div>
                    </td>
                    <td className="px-4 py-3"><SourceBadge source={listing.source} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[shownStatus(listing)] || STATUS_STYLES.seen}`}>
                          {statusLabel(shownStatus(listing))}
                        </span>
                        <CancelStatusBadge status={listing.cancelStatus} />
                        <RuleCheckBadge check={listing.ruleCheck} />
                        {listing.testAccept && (
                          <span
                            title="FlyGuys test accept (temporary test rules). Cancel it with the Mission Coordinator."
                            className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800"
                          >
                            Test accept
                          </span>
                        )}
                        <CancelGigButton
                          listingId={listing.id}
                          listing={listing}
                          bookingStatus={listing.bookingStatus}
                          bookingAcceptedAt={listing.bookingAcceptedAt}
                          workComplete={listing.workComplete}
                          onUpdated={() => fetchListings()}
                        />
                        <DeleteListingButton compact listing={listing} onDeleted={() => fetchListings()} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200"><MissionTypeText listing={listing} /></td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{money(listing.payout)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                      {listing.travelDistance != null ? `${listing.travelDistance} mi` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 max-w-xs truncate">
                      {labelList(listing.requiredEquipment).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                      {(listing.deadline || listing.dueWindowStart)
                        ? formatWhen(listing.deadline || listing.dueWindowStart)
                        : <span className="text-gray-500 dark:text-gray-400">Received {formatWhen(listing.receivedAt || listing.firstSeenAt)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              disabled={!pagination.hasPrevPage}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
              className="text-sm text-blue-600 disabled:text-gray-400"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={!pagination.hasNextPage}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="text-sm text-blue-600 disabled:text-gray-400"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-6" onClick={() => setSelectedId(null)}>
          <div
            className="bg-white dark:bg-gray-800 w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {detail ? listingTitle(detail) : "Mission listing"}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  {detail ? (
                    <>
                      <SourceBadge source={detail.source} />
                      <span className="font-mono text-xs break-all">{detail.externalMissionId}</span>
                      {missionPageUrl(detail) && (
                        <a href={missionPageUrl(detail)} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">
                          Open on {sourceLabel(detail.source)}
                        </a>
                      )}
                    </>
                  ) : "Loading…"}
                </div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white" aria-label="Close">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            {detailLoading || !detail ? (
              <p className="p-5 text-sm text-gray-500 dark:text-gray-400">{saveMessage || "Loading listing…"}</p>
            ) : (
              <div className="p-5 space-y-6">
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[shownStatus(detail)] || STATUS_STYLES.seen}`}>
                    {statusLabel(shownStatus(detail))}
                  </span>
                  <CancelStatusBadge status={detail.cancelStatus} />
                  {detail.deletedAt && (
                    <span className="inline-flex rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-200">Deleted</span>
                  )}
                  <CancelGigButton
                    listingId={detail.id}
                    listing={detail}
                    bookingStatus={detail.bookingStatus}
                    bookingAcceptedAt={detail.bookingAcceptedAt}
                    workComplete={detail.workComplete}
                    onUpdated={(listing) => {
                      setDetail(listing);
                      fetchListings();
                    }}
                  />
                  {!detail.ruleCheck && detail.declineReason && (
                    <span className="inline-flex rounded-full bg-amber-50 dark:bg-amber-900/40 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200">
                      {detail.declineReason}
                    </span>
                  )}
                </div>

                <RuleCheckSection check={detail.ruleCheck} />

                {listingMessageText(detail) && (isSparseListing(detail) || detail.source !== "zeitview") && (
                  <section>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Message</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Received {formatWhen(detail.receivedAt || detail.firstSeenAt)}</p>
                    <p className="whitespace-pre-wrap break-words rounded-lg bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-900 dark:text-gray-100">{listingMessageText(detail)}</p>
                  </section>
                )}

                {detail.source === "zeitview" && detailsUnavailable(detail) && (
                  <p className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                    Details unavailable. The mission page returned Not Found when the bot opened it, so only the email details were stored.
                  </p>
                )}
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-gray-500 dark:text-gray-400">Client</dt><dd className="text-gray-900 dark:text-white">{detail.clientName || (detailsUnavailable(detail) ? "Details unavailable" : "—")}</dd></div>
                  <div><dt className="text-gray-500 dark:text-gray-400">Mission type</dt><dd className="text-gray-900 dark:text-white">{detail.missionType ? <MissionTypeText listing={detail} /> : (detailsUnavailable(detail) ? "Details unavailable" : "—")}</dd></div>
                  <div className="sm:col-span-2 flex gap-2">
                    <FiMapPin className="mt-0.5 text-gray-400" />
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Address</dt>
                      <dd className="text-gray-900 dark:text-white">{listingAddress(detail) || (isSparseListing(detail) ? "Not in message" : "—")}</dd>
                      {(detail.latitude != null || detail.longitude != null) && (
                        <dd className="text-xs text-gray-500 dark:text-gray-400">{detail.latitude}, {detail.longitude}</dd>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2"><FiDollarSign className="mt-0.5 text-gray-400" /><div><dt className="text-gray-500 dark:text-gray-400">Payout</dt><dd className="text-gray-900 dark:text-white">{detail.payout == null && isSparseListing(detail) ? "Not in message" : money(detail.payout)}</dd></div></div>
                  <div className="flex gap-2"><FiClock className="mt-0.5 text-gray-400" /><div><dt className="text-gray-500 dark:text-gray-400">Travel from home</dt><dd className="text-gray-900 dark:text-white">{detail.travelDistance != null ? `${detail.travelDistance} mi` : "—"}{detail.travelTime != null ? ` · ${detail.travelTime} min` : ""}</dd></div></div>
                  <div><dt className="text-gray-500 dark:text-gray-400">Due window</dt><dd className="text-gray-900 dark:text-white">{formatWhen(detail.dueWindowStart)} – {formatWhen(detail.dueWindowEnd)}</dd></div>
                  <div><dt className="text-gray-500 dark:text-gray-400">Deadline</dt><dd className="text-gray-900 dark:text-white">{formatWhen(detail.deadline)}</dd></div>
                  <div><dt className="text-gray-500 dark:text-gray-400">On site</dt><dd className="text-gray-900 dark:text-white">{detail.estimatedOnSiteMinutes != null ? `${detail.estimatedOnSiteMinutes} min` : "—"}</dd></div>
                  <div><dt className="text-gray-500 dark:text-gray-400">Seen</dt><dd className="text-gray-900 dark:text-white">{formatWhen(detail.firstSeenAt)} → {formatWhen(detail.lastSeenAt)}</dd></div>
                </dl>

                {detail.bookingId && (
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    Accepted booking: <span className="font-mono text-xs">{detail.bookingId}</span>
                  </p>
                )}

                {isSparseListing(detail) ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">This {sourceLabel(detail.source)} listing came in as a message, so equipment, deliverables and a flight plan were not provided. Read the message above for details.</p>
                ) : (<>
                <section>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Equipment and certifications</h3>
                  {(() => {
                    const all = [...labelList(detail.requiredEquipment), ...labelList(detail.requiredCertifications)];
                    const unique = dedupeEquipment(all, detail.deliverables);
                    const moved = unique.length < all.length;
                    return <SpecList items={unique} empty={moved ? "Camera specs are under Deliverables." : "None listed."} />;
                  })()}
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Deliverables</h3>
                  <SpecList items={detail.deliverables} empty="None listed." />
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Flight plan</h3>
                  {Array.isArray(detail.flightPlan) && detail.flightPlan.length > 0 ? (
                    <ol className="space-y-3">
                      {detail.flightPlan.map((step, index) => (
                        <li key={`${step.name || "step"}-${index}`} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {index + 1}. {step.name || "Untitled step"}
                            </span>
                            {step.shot_type && (
                              <span className="text-xs rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 px-2 py-0.5">
                                {SHOT_LABELS[step.shot_type] || step.shot_type}
                              </span>
                            )}
                            {step.required ? (
                              <span className="inline-flex items-center text-xs text-green-700 dark:text-green-300"><FiCheck className="mr-1" /> Required</span>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-gray-400">Optional</span>
                            )}
                          </div>
                          {step.instructions && (
                            <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{step.instructions}</p>
                          )}
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {step.altitude != null ? `Altitude ${step.altitude}` : "Altitude not set"}
                            {step.angle != null ? ` · angle ${step.angle}` : ""}
                            {step.count != null ? ` · ${step.count} shots` : ""}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{detailsUnavailable(detail) ? "Details unavailable: the mission page could not be read." : "No capture steps were stored for this listing."}</p>
                  )}
                </section>

                </>)}

                <ListingManageSection
                  listing={detail}
                  onChanged={(listing) => {
                    if (listing) {
                      setDetail(listing);
                      setTags(Array.isArray(listing.tags) ? listing.tags : []);
                    }
                    fetchListings();
                  }}
                  onDeleted={() => {
                    setSelectedId(null);
                    setDetail(null);
                    fetchListings();
                  }}
                />

                <section>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center"><FiTag className="mr-2" /> Notes and tags</h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => setTags(tags.filter((item) => item !== tag))}
                        className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/40 px-2.5 py-1 text-xs text-blue-800 dark:text-blue-100"
                      >
                        {tag} <FiX className="ml-1" />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mb-3">
                    <input
                      className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                      placeholder="Add a tag, such as have skills"
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addTag();
                        }
                      }}
                    />
                    <button type="button" onClick={addTag} className="px-3 py-2 text-sm rounded-md bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white">
                      Add
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                    placeholder="Notes for yourself. The bot does not overwrite these."
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={saveNotes}
                      disabled={saving}
                      className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save notes"}
                    </button>
                    {saveMessage && <span className="text-sm text-gray-600 dark:text-gray-300">{saveMessage}</span>}
                  </div>
                </section>

                {(detail.rawEmailText || detail.rawEmailHtml || detail.rawDetail) && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-gray-700 dark:text-gray-200">Original message and raw detail</summary>
                    {detail.rawEmailText && (
                      <pre className="mt-3 whitespace-pre-wrap text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-md overflow-x-auto text-gray-800 dark:text-gray-100">{detail.rawEmailText}</pre>
                    )}
                    {detail.rawEmailHtml && (
                      <pre className="mt-3 whitespace-pre-wrap text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-md overflow-x-auto text-gray-800 dark:text-gray-100">{detail.rawEmailHtml}</pre>
                    )}
                    {detail.rawDetail && (
                      <pre className="mt-3 whitespace-pre-wrap text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-md overflow-x-auto text-gray-800 dark:text-gray-100">{JSON.stringify(detail.rawDetail, null, 2)}</pre>
                    )}
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
