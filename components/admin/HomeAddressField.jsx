import { useEffect, useId, useRef, useState } from "react";
import { FiEdit2 } from "react-icons/fi";
import { normalizeAddress } from "@/libs/botRules";

const inputClass =
  "block w-full min-h-11 cursor-text rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50/60 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-500 dark:bg-gray-900 dark:text-white dark:hover:border-blue-400 dark:hover:bg-gray-900 dark:focus:border-blue-400 dark:focus:bg-gray-900 dark:focus:ring-blue-400 sm:text-sm";

function EditHint() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-300">
      <FiEdit2 className="h-3.5 w-3.5" aria-hidden="true" />
      Edit
    </span>
  );
}

function newSessionToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "00000000-0000-4000-8000-000000000000";
}

function validCoordinate(value, min, max) {
  const text = String(value ?? "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < min || amount > max) return null;
  return amount;
}

export default function HomeAddressField({
  address,
  lat,
  lng,
  pinSource,
  mapsAvailable,
  fallbackRequested,
  error,
  disabled,
  onChange,
}) {
  const listId = useId();
  const helpId = useId();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [searchBroken, setSearchBroken] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualError, setManualError] = useState("");
  const [mapFailed, setMapFailed] = useState(false);
  const sessionToken = useRef(newSessionToken());
  const requestId = useRef(0);

  const pinned = pinSource === "saved" || pinSource === "place" || pinSource === "manual";
  const showFallback = !mapsAvailable || searchBroken || Boolean(lookupError) || fallbackRequested;

  useEffect(() => {
    if (!mapsAvailable || searchBroken || pinned) {
      setSuggestions([]);
      setOpen(false);
      return undefined;
    }
    const text = address.trim();
    if (text.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      const current = requestId.current + 1;
      requestId.current = current;
      setSearching(true);
      try {
        const response = await fetch("/api/admin/places/autocomplete", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ input: text, sessionToken: sessionToken.current }),
        });
        const body = await response.json().catch(() => ({}));
        if (current !== requestId.current) return;
        if (!response.ok) {
          setSuggestions([]);
          setOpen(false);
          setLookupError(body.message || "We couldn't look up that address. Try again, or enter the coordinates.");
          if (body.code === "search_unavailable" || response.status === 503) setSearchBroken(true);
          return;
        }
        const next = body.data?.suggestions || [];
        setSuggestions(next);
        setActiveIndex(0);
        setOpen(next.length > 0);
        setLookupError("");
      } catch (fetchError) {
        if (fetchError?.name === "AbortError") return;
        setLookupError("We couldn't look up that address. Try again, or enter the coordinates.");
      } finally {
        if (current === requestId.current) setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [address, mapsAvailable, pinned, searchBroken]);

  function emit(next) {
    onChange(next);
  }

  function editAddress(value) {
    const stillPinned = pinned && normalizeAddress(value) === normalizeAddress(address);
    emit({
      address: value,
      lat,
      lng,
      pinSource: stillPinned ? pinSource : "none",
    });
    if (!stillPinned) setLookupError("");
  }

  async function pick(suggestion) {
    setOpen(false);
    setSearching(true);
    setLookupError("");
    try {
      const response = await fetch("/api/admin/places/details", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: suggestion.placeId,
          sessionToken: sessionToken.current,
        }),
      });
      const body = await response.json().catch(() => ({}));
      sessionToken.current = newSessionToken();
      if (!response.ok) {
        setLookupError(body.message || "We couldn't look up that address. Try again, or enter the coordinates.");
        if (body.code === "search_unavailable" || response.status === 503) setSearchBroken(true);
        return;
      }
      emit({
        address: body.data.formattedAddress,
        lat: String(body.data.lat),
        lng: String(body.data.lng),
        pinSource: "place",
      });
      setManualOpen(false);
      setSuggestions([]);
    } catch {
      sessionToken.current = newSessionToken();
      setLookupError("We couldn't look up that address. Try again, or enter the coordinates.");
    } finally {
      setSearching(false);
    }
  }

  function applyManual(event) {
    event.preventDefault();
    const nextLat = validCoordinate(manualLat, -90, 90);
    const nextLng = validCoordinate(manualLng, -180, 180);
    if (normalizeAddress(address).length < 8) {
      setManualError("Type the address in the search box, then enter its coordinates.");
      return;
    }
    if (nextLat == null || nextLng == null) {
      setManualError("Enter a latitude from -90 to 90 and a longitude from -180 to 180.");
      return;
    }
    setManualError("");
    emit({
      address,
      lat: String(nextLat),
      lng: String(nextLng),
      pinSource: "manual",
    });
    setManualOpen(false);
  }

  function onKeyDown(event) {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const mapSrc = pinned && mapsAvailable && lat !== "" && lng !== ""
    ? `/api/admin/places/map?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
    : "";

  useEffect(() => {
    setMapFailed(false);
  }, [mapSrc]);

  return (
    <div>
      <label
        htmlFor="homeAddress"
        className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-gray-900 dark:text-white"
      >
        <span>Home address</span>
        <EditHint />
      </label>
      <p id={helpId} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {mapsAvailable && !searchBroken
          ? "Drive time is measured from here. Start typing, then choose the address from the list."
          : "Drive time is measured from here."}
      </p>
      <div className="relative mt-2">
        <input
          id="homeAddress"
          type="text"
          role="combobox"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
          aria-describedby={error ? `${helpId} homeAddress-error` : helpId}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          className={inputClass}
          value={address}
          placeholder="Start typing the home address"
          onChange={(event) => editAddress(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 150);
          }}
        />
        {searching ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Looking up addresses...</p>
        ) : null}
        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="mt-2 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
          >
            {suggestions.map((suggestion, index) => (
              <li key={suggestion.placeId} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  className={`min-h-11 w-full px-3 py-3 text-left text-base ${
                    index === activeIndex ? "bg-blue-50 dark:bg-blue-900/40" : ""
                  }`}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => pick(suggestion)}
                >
                  <span className="block text-gray-900 dark:text-white">{suggestion.mainText}</span>
                  {suggestion.secondaryText ? (
                    <span className="block text-sm text-gray-500 dark:text-gray-400">{suggestion.secondaryText}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {pinned ? (
        <div className="mt-3">
          <p className="text-sm text-gray-700 dark:text-gray-200">Pinned: {address}</p>
          {mapSrc && !mapFailed ? (
            // The browser must request this with the admin session. The image
            // optimizer would fetch it without that cookie.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mapSrc}
              alt=""
              className="mt-2 h-32 w-full rounded-md bg-gray-100 object-cover dark:bg-gray-700"
              onError={() => setMapFailed(true)}
            />
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p id="homeAddress-error" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {lookupError ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{lookupError}</p>
      ) : null}
      {showFallback && !lookupError && !mapsAvailable ? (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Address search isn&apos;t available right now.
        </p>
      ) : null}

      {showFallback ? (
        <div className="mt-3">
          <button
            type="button"
            className="min-h-11 text-left text-sm font-medium text-blue-700 underline dark:text-blue-300"
            aria-expanded={manualOpen}
            onClick={() => setManualOpen((openNow) => !openNow)}
          >
            Enter coordinates instead
          </button>
          {manualOpen ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="manualLat"
                  className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-gray-900 dark:text-white"
                >
                  <span>Latitude</span>
                  <EditHint />
                </label>
                <input
                  id="manualLat"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className={`${inputClass} mt-1`}
                  value={manualLat}
                  onChange={(event) => setManualLat(event.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="manualLng"
                  className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-gray-900 dark:text-white"
                >
                  <span>Longitude</span>
                  <EditHint />
                </label>
                <input
                  id="manualLng"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className={`${inputClass} mt-1`}
                  value={manualLng}
                  onChange={(event) => setManualLng(event.target.value)}
                />
              </div>
              {manualError ? (
                <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">{manualError}</p>
              ) : null}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  className="min-h-11 cursor-pointer rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                  onClick={applyManual}
                >
                  Use these coordinates
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
