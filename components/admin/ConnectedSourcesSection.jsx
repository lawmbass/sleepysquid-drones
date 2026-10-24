import { useCallback, useEffect, useState } from "react";
import { GIG_SOURCES_MIGRATION } from "@/libs/gigSources";

const DOT_CLASS = {
  green: "bg-green-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  gray: "bg-gray-400 dark:bg-gray-500",
};

function initials(name) {
  const letters = String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return letters || "?";
}

function Mark({ source }) {
  if (source.logoSrc) {
    return (
      // Local brand SVG. next/image does not optimize this placeholder.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source.logoSrc}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-600"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-600"
    >
      {initials(source.name)}
    </span>
  );
}

function SourceSwitch({ source, busy, onToggle }) {
  const label = source.enabled ? "Enabled" : "Disabled";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={source.enabled}
      aria-label={`${source.name} ${source.enabled ? "enabled" : "disabled"}`}
      aria-describedby={`${source.key}-status`}
      aria-busy={busy}
      disabled={busy}
      onClick={() => onToggle(source)}
      className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-gray-900"
    >
      <span className="whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{label}</span>
      <span
        aria-hidden="true"
        data-switch-track
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          source.enabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
            source.enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function SourceRow({ source, busy, onToggle }) {
  const spoken = `${source.statusLabel}. ${source.statusText}`;
  return (
    <li
      className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900"
      data-source={source.key}
      data-health={source.dot}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Mark source={source} />
          <p className="min-w-0 truncate text-base font-medium leading-6 text-gray-900 dark:text-white">{source.name}</p>
        </div>
        <SourceSwitch source={source} busy={busy} onToggle={onToggle} />
      </div>
      {source.summary ? (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400" data-source-summary>
          {source.summary}
        </p>
      ) : null}
      <p
        id={`${source.key}-status`}
        className="mt-2 flex min-w-0 items-start gap-2 text-sm text-gray-600 dark:text-gray-300"
        title={spoken}
        aria-live="polite"
      >
        <span
          aria-hidden="true"
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASS[source.dot] || DOT_CLASS.orange}`}
        />
        <span className="min-w-0 break-words">
          <span className="font-medium text-gray-900 dark:text-white">{source.statusLabel}.</span> {source.statusText}
        </span>
      </p>
    </li>
  );
}

export default function ConnectedSourcesSection({
  controlled = false,
  sources: controlledSources = null,
  tableReady: controlledTableReady = true,
  onToggle,
}) {
  const [sources, setSources] = useState(controlled ? controlledSources || [] : []);
  const [tableReady, setTableReady] = useState(controlledTableReady);
  const [loading, setLoading] = useState(!controlled);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [togglingKey, setTogglingKey] = useState("");

  useEffect(() => {
    if (!controlled) return;
    setSources(controlledSources || []);
    setTableReady(controlledTableReady);
  }, [controlled, controlledSources, controlledTableReady]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/gig-sources", { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || "Could not load connected sources.");
      }
      setSources(body.data?.sources || []);
      setTableReady(body.data?.tableReady !== false);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Could not load connected sources.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (controlled) return undefined;
    load();
    return undefined;
  }, [controlled, load]);

  async function toggle(source) {
    if (togglingKey) return;
    const enabled = !source.enabled;
    if (controlled) {
      onToggle?.(source, enabled);
      return;
    }

    setTogglingKey(source.key);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/gig-sources", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey: source.key, enabled }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || "Could not update that source.");
      }
      setSources(body.data?.sources || []);
      setTableReady(body.data?.tableReady !== false);
      setNotice(body.message || "");
    } catch (toggleError) {
      setError(toggleError.message || "Could not update that source.");
    } finally {
      setTogglingKey("");
    }
  }

  return (
    <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 sm:p-6" data-connected-sources>
      <h2 className="text-lg font-medium text-gray-900 dark:text-white">Connected sources</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        The drone-gigs bot pulls gigs from each enabled source and adds SleepySquid bookings. Disable a
        source to stop that. Gray means off. Green means gigs are landing. Orange means something needs a
        fix. Red means it is broken.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">Loading connected sources...</p>
      ) : null}

      {error ? (
        <div
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          {notice}
        </div>
      ) : null}
      {!loading && !tableReady ? (
        <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">
          The source list is not in the database yet, so every source stays enabled. Apply {GIG_SOURCES_MIGRATION}{" "}
          before the switch can be saved.
        </p>
      ) : null}

      {!loading && sources.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {sources.map((source) => (
            <SourceRow
              key={source.key}
              source={source}
              busy={togglingKey === source.key}
              onToggle={toggle}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
