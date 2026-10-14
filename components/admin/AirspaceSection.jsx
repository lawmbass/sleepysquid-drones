import { useState } from "react";

const VERDICT_STYLE = {
  Realistic: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "Needs LAANC": "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  "Not realistic": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  "Couldn't verify": "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

export default function AirspaceSection() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/airspace-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.message || "Couldn't run the airspace check.");
        return;
      }
      setResult(body?.data || null);
    } catch {
      setError("Couldn't reach the airspace check. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Airspace check</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Internal quoting aid. Look up an address before promising a flight.
        </p>
      </div>

      <form onSubmit={onSubmit} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-4">
        <label htmlFor="airspace-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Job address
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="airspace-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="1600 Pennsylvania Ave NW, Washington, DC"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={loading || address.trim().length < 5}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
          >
            {loading ? "Checking..." : "Check address"}
          </button>
        </div>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </form>

      {result ? <AirspaceResult result={result} /> : null}
    </div>
  );
}

function AirspaceResult({ result }) {
  const style = VERDICT_STYLE[result.verdict] || VERDICT_STYLE["Couldn't verify"];
  const airspace = result.facility?.airspace?.length ? `Class ${result.facility.airspace.join(", ")}` : null;
  const checklistKey = `${result.query}|${result.formattedAddress || ""}|${result.verdict}`;

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
      {result.formattedAddress ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {result.formattedAddress}
          {result.latitude != null ? ` (${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)})` : ""}
        </p>
      ) : null}

      <Checklist key={checklistKey} items={result.checklist || []} />

      {result.shelfNote ? <p className="text-sm text-gray-600 dark:text-gray-300">{result.shelfNote}</p> : null}

      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Facility map ceiling</h2>
        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
          {result.ceilingText}
          {airspace ? ` · ${airspace}` : ""}
          {result.facility?.airport ? ` · ${result.facility.airport}` : ""}
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Sources</h2>
        <ul className="mt-2 space-y-2">
          {result.sources.map((source) => (
            <li key={source.id} className="text-sm text-gray-700 dark:text-gray-300">
              <a href={source.url} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 underline">
                {source.name}
              </a>
              <span className="text-gray-500 dark:text-gray-400"> · {source.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-gray-200 dark:border-gray-700 pt-5">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Verdict</h2>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${style}`}>{result.verdict}</span>
          <p className="text-gray-900 dark:text-white font-medium">{result.summary}</p>
        </div>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{result.disclaimer}</p>
      </section>
    </div>
  );
}

function Checklist({ items }) {
  const [done, setDone] = useState({});

  const toggle = (id) => {
    setDone((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Before quoting</h2>
      <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
        {items.map((entry) => {
          const checked = Boolean(done[entry.id]);
          const inputId = `airspace-item-${entry.id}`;
          return (
            <li key={entry.id} className={`flex gap-3 px-3 py-3 ${checked ? "bg-gray-50 dark:bg-gray-900/40" : ""}`}>
              <input
                id={inputId}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(entry.id)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="min-w-0">
                <label htmlFor={inputId} className="block cursor-pointer">
                  <span className={`block font-medium ${checked ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-white"}`}>
                    {entry.label}
                  </span>
                  <span className="block mt-0.5 text-sm text-gray-600 dark:text-gray-300">{entry.why}</span>
                </label>
                <a
                  href={entry.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-1 text-sm text-blue-600 dark:text-blue-400 underline"
                >
                  {entry.linkLabel}
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
