import { useEffect, useRef, useState } from "react";

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

  // Address suggestions reuse the Bot rules address search (/api/admin/places, Google Places
  // with the existing GOOGLE_MAPS_API_KEY). Picking one runs the check on its coordinates.
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState("");
  const [searchOff, setSearchOff] = useState(false);
  const session = useRef(newSessionToken());
  const seq = useRef(0);

  useEffect(() => {
    const text = address.trim();
    if (searchOff || text.length < 3 || text === picked) { setSuggestions([]); setOpen(false); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const mine = ++seq.current;
      try {
        const response = await fetch("/api/admin/places/autocomplete", {
          method: "POST", credentials: "include", signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: text, sessionToken: session.current }),
        });
        const body = await response.json().catch(() => ({}));
        if (mine !== seq.current) return;
        if (!response.ok) { if (response.status === 503) setSearchOff(true); setOpen(false); return; }
        const next = body.data?.suggestions || [];
        setSuggestions(next); setActive(-1); setOpen(next.length > 0);
      } catch { /* aborted or offline: typing and Enter still work */ }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [address, picked, searchOff]);

  const pick = async (suggestion) => {
    setOpen(false);
    const label = [suggestion.mainText, suggestion.secondaryText].filter(Boolean).join(", ");
    setAddress(label); setPicked(label);
    try {
      const response = await fetch("/api/admin/places/details", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: suggestion.placeId, sessionToken: session.current }),
      });
      session.current = newSessionToken();
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.data) {
        const full = body.data.formattedAddress || label;
        setAddress(full); setPicked(full);
        return runCheck(full, body.data.lat, body.data.lng);
      }
    } catch { /* fall back to geocoding the text */ }
    return runCheck(label);
  };

  const onKeyDown = (event) => {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => (i + 1) % suggestions.length); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1)); }
    else if (event.key === "Enter" && active >= 0) { event.preventDefault(); pick(suggestions[active]); }
    else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    else if (event.key === "Enter") setOpen(false);
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setOpen(false);
    runCheck(address);
  };

  const runCheck = async (query, lat, lng) => {
    if (String(query).trim().length < 5) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/airspace-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(lat != null ? { address: query, lat, lng } : { address: query }),
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
          <div className="relative flex-1">
          <input
            id="airspace-address"
            value={address}
            onChange={(event) => { setAddress(event.target.value); setPicked(""); }}
            onKeyDown={onKeyDown}
            onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="airspace-suggestions"
            aria-activedescendant={open && active >= 0 ? `airspace-suggestion-${active}` : undefined}
            enterKeyHint="search"
            placeholder="1600 Pennsylvania Ave NW, Washington, DC"
            className="w-full min-h-11 px-3 py-2 text-base sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            autoComplete="off"
          />
          {open ? (
            <ul id="airspace-suggestions" role="listbox" data-testid="airspace-suggestions"
              className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
              {suggestions.map((s, i) => (
                <li key={s.placeId} id={`airspace-suggestion-${i}`} role="option" aria-selected={i === active}>
                  <button type="button" tabIndex={-1}
                    className={`min-h-11 w-full px-3 py-2.5 text-left ${i === active ? "bg-blue-50 dark:bg-blue-900/40" : "hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                    onPointerDown={(e) => e.preventDefault()} onClick={() => pick(s)}>
                    <span className="block text-gray-900 dark:text-white">{s.mainText}</span>
                    {s.secondaryText ? <span className="block text-sm text-gray-500 dark:text-gray-400">{s.secondaryText}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          </div>
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

function newSessionToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "00000000-0000-4000-8000-000000000000";
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
