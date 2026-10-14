import { useEffect, useId, useRef, useState } from "react";

function newSessionToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "00000000-0000-4000-8000-000000000000";
}

export default function AddressAutocomplete({
  id,
  value,
  inputClassName,
  placeholder,
  selected = false,
  autocompletePath,
  detailsPath,
  onChange,
  onSelect,
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const sessionToken = useRef(newSessionToken());
  const requestId = useRef(0);

  useEffect(() => {
    if (selected) {
      setSuggestions([]);
      setOpen(false);
      return undefined;
    }
    const text = String(value || "").trim();
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
        const response = await fetch(autocompletePath, {
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
          setLookupError(body.message || "We couldn't look up that address. Try again.");
          return;
        }
        const next = body.data?.suggestions || [];
        setSuggestions(next);
        setActiveIndex(0);
        setOpen(next.length > 0);
        setLookupError("");
      } catch (fetchError) {
        if (fetchError?.name === "AbortError") return;
        setLookupError("We couldn't look up that address. Try again.");
      } finally {
        if (current === requestId.current) setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [autocompletePath, selected, value]);

  async function pick(suggestion) {
    setOpen(false);
    setSearching(true);
    setLookupError("");
    try {
      const response = await fetch(detailsPath, {
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
      if (!response.ok || body.data?.countryCode !== "US") {
        setLookupError(body.message || "Choose a US address from the list.");
        return;
      }
      onSelect({
        location: body.data.formattedAddress,
        placeId: suggestion.placeId,
      });
      setSuggestions([]);
    } catch {
      sessionToken.current = newSessionToken();
      setLookupError("We couldn't look up that address. Try again.");
    } finally {
      setSearching(false);
    }
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
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        placeholder={placeholder}
        value={value}
        className={inputClassName}
        onChange={(event) => {
          setLookupError("");
          onChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
      />
      {searching ? (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Looking up addresses...</p>
      ) : null}
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.placeId} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={`w-full px-3 py-3 text-left text-sm ${
                  index === activeIndex ? "bg-blue-50 dark:bg-blue-900/40" : ""
                }`}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => pick(suggestion)}
              >
                <span className="block text-gray-900 dark:text-white">{suggestion.mainText}</span>
                {suggestion.secondaryText ? (
                  <span className="block text-gray-500 dark:text-gray-400">{suggestion.secondaryText}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {lookupError ? (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{lookupError}</p>
      ) : null}
    </div>
  );
}
