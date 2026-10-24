import { useCallback, useEffect, useRef, useState } from "react";
import { FiEdit2 } from "react-icons/fi";
import ConnectedSourcesSection from "@/components/admin/ConnectedSourcesSection";
import { applyEnabled } from "@/libs/gigSources";
import HomeAddressField from "@/components/admin/HomeAddressField";
import {
  DECISION_LABELS,
  HOME_PIN_REJECTED,
  REASON_LABELS,
  homeAddressChanged,
  sameHomePin,
  snapZeitviewRadius,
  validateBotSettings,
} from "@/libs/botRules";

const EMPTY_FORM = {
  autoAcceptEnabled: true,
  minPayoutUsd: "",
  longTripMinutes: "",
  longTripMinPayoutUsd: "",
  maxDriveMinutes: "",
  homeAddress: "",
  homeLat: "",
  homeLng: "",
  dailyAcceptCap: "",
  minNoticeHours: "",
  travelRadiusAvailable: false,
  travelRadiusMiles: "",
};

function textValue(value) {
  if (value == null) return "";
  return String(value);
}

function formFromSettings(settings) {
  return {
    autoAcceptEnabled: settings.autoAcceptEnabled === true,
    minPayoutUsd: textValue(settings.minPayoutUsd),
    longTripMinutes: textValue(settings.longTripMinutes),
    longTripMinPayoutUsd: textValue(settings.longTripMinPayoutUsd),
    maxDriveMinutes: textValue(settings.maxDriveMinutes),
    homeAddress: settings.homeAddress || "",
    homeLat: textValue(settings.homeLat),
    homeLng: textValue(settings.homeLng),
    dailyAcceptCap: textValue(settings.dailyAcceptCap),
    minNoticeHours: textValue(settings.minNoticeHours),
    travelRadiusAvailable: settings.travelRadiusAvailable === true,
    travelRadiusMiles: settings.travelRadiusMiles == null ? "" : String(settings.travelRadiusMiles),
  };
}

function payloadFromForm(form) {
  const optional = (value) => (String(value).trim() === "" ? null : value);
  return {
    autoAcceptEnabled: form.autoAcceptEnabled,
    minPayoutUsd: form.minPayoutUsd,
    longTripMinutes: form.longTripMinutes,
    longTripMinPayoutUsd: form.longTripMinPayoutUsd,
    maxDriveMinutes: optional(form.maxDriveMinutes),
    homeAddress: form.homeAddress,
    homeLat: form.homeLat,
    homeLng: form.homeLng,
    dailyAcceptCap: optional(form.dailyAcceptCap),
    minNoticeHours: optional(form.minNoticeHours),
    ...(form.travelRadiusAvailable
      ? { travelRadiusMiles: form.travelRadiusMiles === "" ? null : form.travelRadiusMiles }
      : {}),
  };
}

function money(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function minutes(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })} min`;
}

function formatDollars(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatMinutes(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} min`;
}

function displayValue(id, source) {
  if (id === "autoAcceptEnabled") {
    return source.autoAcceptEnabled ? "Auto-accept is on" : "Auto-accept is off";
  }
  if (id === "minPayoutUsd" || id === "longTripMinPayoutUsd") return formatDollars(source[id]);
  if (id === "longTripMinutes") return formatMinutes(source[id]);
  if (id === "maxDriveMinutes") {
    return String(source.maxDriveMinutes).trim() === "" ? "No maximum" : formatMinutes(source.maxDriveMinutes);
  }
  if (id === "dailyAcceptCap") {
    return String(source.dailyAcceptCap).trim() === "" ? "No cap" : String(source.dailyAcceptCap);
  }
  if (id === "minNoticeHours") {
    return String(source.minNoticeHours).trim() === "" ? "Not checked" : `${source.minNoticeHours} hours`;
  }
  if (id === "homeAddress") return source.homeAddress || "No address pinned";
  if (id === "travelRadiusMiles") {
    return String(source.travelRadiusMiles).trim() === "" ? "No maximum" : `${source.travelRadiusMiles} miles`;
  }
  return "";
}

function travelRadiusHint(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Blank leaves the distance already set on each site.";
  const snapped = snapZeitviewRadius(text);
  if (!snapped || typeof snapped === "object") return "";
  if (Number(text) === snapped) return `Zeitview profile uses ${snapped} miles.`;
  return `Zeitview profile uses ${snapped} miles, the nearest allowed radius.`;
}

const RULES = [
  {
    id: "autoAcceptEnabled",
    label: "Accept gigs automatically",
    help: "Turn this off to keep recording missions the bot sees, without accepting them.",
    kind: "boolean",
  },
  {
    id: "minPayoutUsd",
    label: "Minimum payout",
    help: "Turn down a gig that pays less than this. Use 0 to 100,000.",
    kind: "decimal",
  },
  {
    id: "longTripMinutes",
    label: "Long trip starts at",
    help: "A drive this long, or longer, has to meet the higher payout. Use 1 to 1,440 (24 hours).",
    kind: "whole",
  },
  {
    id: "longTripMinPayoutUsd",
    label: "Long-trip minimum payout",
    help: "The least a long drive must pay. This cannot be lower than the regular minimum.",
    kind: "decimal",
  },
  {
    id: "maxDriveMinutes",
    label: "Maximum drive",
    help: "Leave blank for no maximum. A longer drive is never accepted. Use 1 to 1,440 if you set one.",
    kind: "whole",
  },
  {
    id: "dailyAcceptCap",
    label: "Daily accept cap",
    help: "The most gigs the bot may accept on one Eastern day. Leave blank for no cap. Use 1 to 48 if you set one.",
    kind: "whole",
  },
  {
    id: "minNoticeHours",
    label: "Minimum notice",
    help: "How long before the flight the bot must already have seen the gig. Leave blank to ignore notice. Use 0 to 168 if you set one. The preview only applies this when a real flight time is stored.",
    kind: "whole",
  },
  {
    id: "travelRadiusMiles",
    label: "Travel radius",
    help: "How far you will go for a gig, in miles. Leave blank for no maximum. Use 1 to 500 if you set one. This one number applies to every connected source the bot can update. Zeitview's profile only accepts 10, 25, 50, 100, or 200 miles, so the bot snaps to the nearest of those. A save does not update Droners.",
    kind: "whole",
  },
  {
    id: "homeAddress",
    label: "Home address",
    help: "Drive time is measured from here.",
    kind: "address",
  },
];

const PREVIEW_FIELDS = [
  "autoAcceptEnabled",
  "minPayoutUsd",
  "longTripMinutes",
  "longTripMinPayoutUsd",
  "maxDriveMinutes",
  "dailyAcceptCap",
  "minNoticeHours",
];

function previewPayload(form, savedForm, pinSource) {
  const saved = payloadFromForm(savedForm);
  const draft = payloadFromForm(form);
  let current = saved;
  for (const key of PREVIEW_FIELDS) {
    if (draft[key] === saved[key]) continue;
    const next = { ...current, [key]: draft[key] };
    if (validateBotSettings(next).ok) current = next;
  }
  const typedAddress = pinSource === "none" && homeAddressChanged(saved.homeAddress, draft.homeAddress);
  if (!typedAddress) {
    const next = {
      ...current,
      homeAddress: draft.homeAddress,
      homeLat: draft.homeLat,
      homeLng: draft.homeLng,
    };
    if (validateBotSettings(next).ok) current = next;
  }
  return current;
}

function Rule({
  id,
  label,
  help,
  value,
  editing,
  focusField,
  error,
  children,
  className = "",
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!editing || !focusField) return;
    panelRef.current?.querySelector("input, select, textarea")?.focus();
  }, [editing, focusField]);

  return (
    <div className={`border-b border-gray-100 py-4 last:border-b-0 dark:border-gray-700 ${className}`} data-rule={id}>
      {editing ? (
        <label htmlFor={id} className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </label>
      ) : (
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <p id={`${id}-label`} className="text-sm font-medium text-gray-900 dark:text-white">
            {label}
          </p>
          <p className="text-base text-gray-900 dark:text-white sm:text-right" aria-labelledby={`${id}-label`}>
            {value}
          </p>
        </div>
      )}
      <p id={`${id}-help`} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {help}
      </p>
      {editing ? (
        <div ref={panelRef} className="mt-2">
          {children}
          {error ? (
            <p id={`${id}-error`} className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const inputClass =
  "block w-full min-h-11 cursor-text rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50/60 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-500 dark:bg-gray-900 dark:text-white dark:hover:border-blue-400 dark:hover:bg-gray-900 dark:focus:border-blue-400 dark:focus:bg-gray-900 dark:focus:ring-blue-400 sm:text-sm";

const CARD_DECISIONS = {
  accept: {
    label: "Accept",
    className: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  },
  decline: {
    label: "Decline",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
  },
  unsure: {
    label: "Can't tell",
    className: "bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100",
  },
  skip: {
    label: "Auto-accept off",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
  },
};

function ReasonChips({ sample, fullWidth = false }) {
  const chips = Array.isArray(sample.failures) && sample.failures.length
    ? sample.failures
    : sample.reason
      ? [{
          code: sample.reason,
          tone: sample.decision === "unsure" ? "unsure" : "decline",
          text: REASON_LABELS[sample.reason] || sample.reason,
        }]
      : [];
  if (!chips.length) return null;
  return (
    <ul className={`mt-1 flex flex-wrap gap-1 ${fullWidth ? "w-full" : "max-w-[14rem] sm:max-w-xs"}`}>
      {chips.map((chip) => (
        <li
          key={chip.code}
          className={`max-w-full rounded px-1.5 py-0.5 text-xs leading-snug ${
            chip.tone === "unsure"
              ? "bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100"
              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
          }`}
        >
          {chip.text}
        </li>
      ))}
    </ul>
  );
}

function initialForm(preview) {
  return preview?.settings ? formFromSettings(preview.settings) : EMPTY_FORM;
}

export default function BotRulesSection({ fixture = null }) {
  const [form, setForm] = useState(() => initialForm(fixture));
  const [savedForm, setSavedForm] = useState(() => initialForm(fixture));
  const [savedKey, setSavedKey] = useState(() => {
    const next = initialForm(fixture);
    return fixture?.settings ? JSON.stringify(payloadFromForm(next)) : "";
  });
  const [editing, setEditing] = useState(false);
  const [focusRuleId, setFocusRuleId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [ruleError, setRuleError] = useState("");
  const [loading, setLoading] = useState(!fixture);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mapsKeyConfigured, setMapsKeyConfigured] = useState(false);
  const [pinSource, setPinSource] = useState("saved");
  const [coordinateFallback, setCoordinateFallback] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(fixture?.settings?.updatedAt || null);
  const [fixtureSources, setFixtureSources] = useState(fixture?.sources || null);
  const [updatedBy, setUpdatedBy] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [previewSource, setPreviewSource] = useState("saved");
  const [previewDriveSource, setPreviewDriveSource] = useState("stored");
  const [driveTimesUpdating, setDriveTimesUpdating] = useState(false);
  const driveTimesUpdatingRef = useRef(false);
  const savedPreviewRef = useRef(null);
  const previewRequest = useRef(0);
  const editRulesButtonRef = useRef(null);
  const pendingFocusReturn = useRef(false);
  driveTimesUpdatingRef.current = driveTimesUpdating;

  const rememberSavedPreview = useCallback((data) => {
    savedPreviewRef.current = {
      preview: data.preview || null,
      previewError: data.previewError || "",
      previewSource: data.previewSource || "saved",
      previewDriveSource: data.previewDriveSource || "stored",
    };
  }, []);

  const showSavedPreview = useCallback(() => {
    const saved = savedPreviewRef.current;
    if (!saved) return;
    setPreview(saved.preview);
    setPreviewError(saved.previewError);
    setPreviewSource(saved.previewSource);
    setPreviewDriveSource(saved.previewDriveSource);
  }, []);

  const applyResponse = useCallback((data, { replaceForm, driveStatus }) => {
    if (replaceForm && data.settings) {
      const next = formFromSettings(data.settings);
      setForm(next);
      setSavedForm(next);
      setPinSource("saved");
      setCoordinateFallback(false);
      setSavedKey(JSON.stringify(payloadFromForm(next)));
      setUpdatedAt(data.settings.updatedAt || null);
      setUpdatedBy(data.settings.updatedBy || null);
    }
    setMapsKeyConfigured(Boolean(data.mapsKeyConfigured));
    setPreview(data.preview || null);
    setPreviewError(data.previewError || "");
    setPreviewSource(data.previewSource || "saved");
    setPreviewDriveSource(data.previewDriveSource || "stored");
    if (replaceForm || data.previewSource !== "form") rememberSavedPreview(data);
    if (driveStatus && data.driveTimesUpdating != null) {
      setDriveTimesUpdating(Boolean(data.driveTimesUpdating));
    }
  }, [rememberSavedPreview]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/bot-settings", { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || "Failed to load bot rules.");
      }
      applyResponse(body.data || {}, { replaceForm: true, driveStatus: true });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    if (fixture) return undefined;
    load();
    return undefined;
  }, [load, fixture]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  }

  function errorsByField(errors) {
    const next = {};
    for (const item of errors || []) {
      if (!next[item.field]) next[item.field] = item.message;
    }
    return next;
  }

  const draftChanged = Boolean(
    editing &&
      savedKey &&
      (JSON.stringify(payloadFromForm(form)) !== savedKey || pinSource !== "saved")
  );

  function beginEdit() {
    if (editing || saving) return;
    setFocusRuleId(RULES[0].id);
    setNotice("");
    setEditing(true);
  }

  function leaveEdit() {
    pendingFocusReturn.current = true;
    setEditing(false);
    setFocusRuleId(null);
  }

  function cancelEdit() {
    previewRequest.current += 1;
    setPreviewing(false);
    setForm(savedForm);
    setPinSource("saved");
    setCoordinateFallback(false);
    setFieldErrors({});
    setRuleError("");
    showSavedPreview();
    leaveEdit();
  }

  async function saveRules() {
    const payload = payloadFromForm(form);
    const saved = savedKey ? JSON.parse(savedKey) : {};
    if (
      homeAddressChanged(saved.homeAddress, payload.homeAddress) &&
      pinSource === "none" &&
      !mapsKeyConfigured
    ) {
      setCoordinateFallback(true);
      setFieldErrors({ homeAddress: HOME_PIN_REJECTED });
      setRuleError("");
      setNotice("");
      return;
    }
    const validated = validateBotSettings(payload);
    if (!validated.ok) {
      const errors = errorsByField(validated.errors);
      if ((errors.homeLat || errors.homeLng) && !errors.homeAddress) {
        errors.homeAddress = HOME_PIN_REJECTED;
        setCoordinateFallback(true);
      }
      setFieldErrors(errors);
      setRuleError("");
      setNotice("");
      return;
    }

    setSaving(true);
    setRuleError("");
    setNotice("");
    setFieldErrors({});
    try {
      const response = await fetch("/api/admin/bot-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, homePinSource: pinSource }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errors = errorsByField(body.errors);
        setFieldErrors(errors);
        if (body.errors?.some((item) => item.field === "homeAddress")) {
          setCoordinateFallback(true);
        }
        if (!Object.keys(errors).length) {
          setRuleError(body.message || "Could not update bot rules.");
        }
        return;
      }
      applyResponse(body.data || {}, { replaceForm: true, driveStatus: true });
      setNotice(body.message || "Bot rules saved.");
      leaveEdit();
    } catch (saveError) {
      setRuleError(saveError.message || "Could not update bot rules.");
    } finally {
      setSaving(false);
    }
  }

  const previewDraft = useCallback(async (payload, source, signal) => {
    const requestId = previewRequest.current + 1;
    previewRequest.current = requestId;
    setPreviewing(true);
    try {
      const response = await fetch("/api/admin/bot-settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ ...payload, homePinSource: source }),
      });
      const body = await response.json().catch(() => ({}));
      if (requestId !== previewRequest.current) return;
      if (!response.ok) {
        setPreviewError(body.message || "The preview could not be checked.");
        return;
      }
      applyResponse(body.data || {}, { replaceForm: false, driveStatus: false });
    } catch (previewFailure) {
      if (previewFailure?.name === "AbortError" || requestId !== previewRequest.current) return;
      setPreviewError(previewFailure.message || "The preview could not be checked.");
    } finally {
      if (requestId === previewRequest.current) setPreviewing(false);
    }
  }, [applyResponse]);

  const savedPin = savedKey ? JSON.parse(savedKey) : null;
  const unsavedPin = Boolean(savedPin && !sameHomePin(savedPin, form));

  useEffect(() => {
    if (!editing || !savedKey) return undefined;
    const payload = previewPayload(form, savedForm, pinSource);
    if (JSON.stringify(payload) === JSON.stringify(payloadFromForm(savedForm))) {
      previewRequest.current += 1;
      setPreviewing(false);
      showSavedPreview();
      return undefined;
    }
    const controller = new AbortController();
    setPreviewing(true);
    const timer = setTimeout(() => {
      previewDraft(payload, pinSource, controller.signal);
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
      previewRequest.current += 1;
      setPreviewing(false);
    };
  }, [editing, form, pinSource, previewDraft, savedForm, savedKey, showSavedPreview]);

  useEffect(() => {
    if (!editing && pendingFocusReturn.current) {
      pendingFocusReturn.current = false;
      editRulesButtonRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (fixture || unsavedPin || !savedKey || editing) return undefined;
    const saved = JSON.parse(savedKey);
    let cancelled = false;
    let intervalId = null;
    let checking = false;
    let waitingForStored = false;

    async function refreshPreview() {
      const refresh = await fetch("/api/admin/bot-settings", { credentials: "include" });
      const refreshed = await refresh.json().catch(() => ({}));
      if (cancelled || !refresh.ok || !refreshed.data) return;
      rememberSavedPreview(refreshed.data);
      setPreview(refreshed.data.preview || null);
      setPreviewError(refreshed.data.previewError || "");
      setPreviewSource(refreshed.data.previewSource || "saved");
      setPreviewDriveSource(refreshed.data.previewDriveSource || "stored");
    }

    async function checkStoredDrives() {
      if (checking || cancelled) return;
      checking = true;
      try {
        const response = await fetch("/api/admin/bot-settings/drive-times", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ homeLat: saved.homeLat, homeLng: saved.homeLng }),
        });
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          if (driveTimesUpdatingRef.current && !intervalId) {
            intervalId = setInterval(checkStoredDrives, 15000);
          }
          return;
        }
        if (body.data?.matchesStored == null) {
          setDriveTimesUpdating(false);
          return;
        }
        if (body.data.matchesStored === false) {
          waitingForStored = true;
          setDriveTimesUpdating(true);
          if (!intervalId) intervalId = setInterval(checkStoredDrives, 15000);
          return;
        }
        if (body.data?.matchesStored === true) {
          setDriveTimesUpdating(false);
          clearInterval(intervalId);
          intervalId = null;
          if (waitingForStored) {
            waitingForStored = false;
            await refreshPreview();
          }
        }
      } catch {
        // The next poll tries again. The saved rules stay as they are.
      } finally {
        checking = false;
      }
    }

    checkStoredDrives();

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [editing, fixture, unsavedPin, savedKey, rememberSavedPreview]);
  const describedBy = (id) => {
    const ids = [`${id}-help`];
    if (fieldErrors[id]) ids.push(`${id}-error`);
    return ids.join(" ");
  };

  const addressNeedsPin = editing && pinSource === "none" && homeAddressChanged(savedForm.homeAddress, form.homeAddress);
  let previewStatus = "This uses the saved rules, the stored payout, and the stored drive time. Nothing is changed.";
  if (previewDriveSource === "unsaved-pin") {
    previewStatus = "Previewing drive times from your unsaved address. These minutes are not saved. The bot updates stored drive times after you save.";
  } else if (addressNeedsPin && previewSource === "form") {
    previewStatus = "This preview uses the rules you're editing. Choose an address to update drive times. The minutes below are still the stored ones.";
  } else if (addressNeedsPin) {
    previewStatus = "Choose an address to preview drive times from it. The minutes below are still the stored ones.";
  } else if (editing && previewSource === "form") {
    previewStatus = "This preview uses the rules you're editing. Nothing is saved until you press Save changes.";
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-600 dark:text-gray-300">Loading bot rules...</div>
    );
  }

  return (
    <div className={`space-y-6 ${editing ? "pb-[calc(7.5rem+env(safe-area-inset-bottom))]" : ""}`}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bot rules</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          One set of rules for every connected gig source. The drone-gigs bot reads them before it
          accepts a mission. Saving asks the bot to sync the home address and travel radius to each
          enabled source it can update. A save does not update Droners. Edit rules to change them
          together. Save stores every change. Cancel puts
          the saved values back.
        </p>
        {updatedAt ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Last saved {new Date(updatedAt).toLocaleString()}
            {updatedBy ? ` by ${updatedBy}` : ""}.
          </p>
        ) : null}
      </div>

      <ConnectedSourcesSection
        controlled={Boolean(fixture)}
        sources={fixture ? fixtureSources : null}
        tableReady={!fixture || fixture.tableReady !== false}
        onToggle={(source, enabled) => {
          setFixtureSources((current) =>
            (current || []).map((row) => (row.key === source.key ? applyEnabled(row, enabled) : row))
          );
        }}
      />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          {notice}
        </div>
      ) : null}

      <form
        className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 sm:p-6"
        data-rules-card
        onSubmit={(event) => {
          event.preventDefault();
          if (draftChanged && !saving) saveRules();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && editing) {
            event.preventDefault();
            cancelEdit();
          }
        }}
      >
        {editing ? null : (
          <div className="mb-4 flex justify-end">
            <button
              ref={editRulesButtonRef}
              type="button"
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              onClick={beginEdit}
            >
              <FiEdit2 className="h-4 w-4" aria-hidden="true" />
              Edit rules
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          {RULES.filter((rule) => rule.id !== "travelRadiusMiles" || form.travelRadiusAvailable).map((rule) => {
            let help = rule.help;
            if (rule.id === "homeAddress" && editing && mapsKeyConfigured) {
              help = "Drive time is measured from here. Start typing, then choose the address from the list.";
            }
            if (rule.id === "travelRadiusMiles") {
              const hint = travelRadiusHint(editing ? form.travelRadiusMiles : savedForm.travelRadiusMiles);
              if (hint) help = `${help} ${hint}`;
            }
            return (
              <Rule
                key={rule.id}
                id={rule.id}
                label={rule.label}
                help={help}
                value={displayValue(rule.id, savedForm)}
                editing={editing}
                focusField={focusRuleId === rule.id}
                error={rule.id === "homeAddress" ? "" : fieldErrors[rule.id]}
                className={rule.id === "homeAddress" ? "md:col-span-2" : ""}
              >
                {rule.kind === "boolean" ? (
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50/60 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 dark:border-gray-500 dark:bg-gray-900 dark:text-white dark:hover:border-blue-400 dark:focus-within:border-blue-400 dark:focus-within:ring-blue-400 sm:text-sm">
                    <input
                      id={rule.id}
                      type="checkbox"
                      className="h-5 w-5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={form.autoAcceptEnabled}
                      aria-describedby="autoAcceptEnabled-help"
                      disabled={saving}
                      onChange={(event) => setField("autoAcceptEnabled", event.target.checked)}
                    />
                    {form.autoAcceptEnabled ? "Auto-accept is on" : "Auto-accept is off"}
                  </label>
                ) : null}
                {rule.kind === "select" ? (
                  <select
                    id={rule.id}
                    className={`${inputClass} cursor-pointer`}
                    value={form[rule.id]}
                    aria-describedby={describedBy(rule.id)}
                    aria-invalid={Boolean(fieldErrors[rule.id])}
                    disabled={saving}
                    onChange={(event) => setField(rule.id, event.target.value)}
                  >
                    {rule.options.map((option) => (
                      <option key={option.value || "current"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {rule.kind === "decimal" || rule.kind === "whole" ? (
                  <input
                    id={rule.id}
                    type="text"
                    inputMode={rule.kind === "decimal" ? "decimal" : "numeric"}
                    className={inputClass}
                    value={form[rule.id]}
                    aria-describedby={describedBy(rule.id)}
                    aria-invalid={Boolean(fieldErrors[rule.id])}
                    disabled={saving}
                    onChange={(event) => setField(rule.id, event.target.value)}
                  />
                ) : null}
                {rule.kind === "address" ? (
                  <HomeAddressField
                    address={form.homeAddress}
                    lat={form.homeLat}
                    lng={form.homeLng}
                    pinSource={pinSource}
                    mapsAvailable={mapsKeyConfigured}
                    fallbackRequested={coordinateFallback}
                    error={fieldErrors.homeAddress}
                    disabled={saving}
                    embedded
                    describedBy={describedBy("homeAddress")}
                    onChange={(next) => {
                      setForm((current) => ({
                        ...current,
                        homeAddress: next.address,
                        homeLat: next.lat,
                        homeLng: next.lng,
                      }));
                      setPinSource(next.pinSource);
                      setFieldErrors((current) => ({ ...current, homeAddress: "" }));
                    }}
                  />
                ) : null}
              </Rule>
            );
          })}
        </div>
        {editing ? (
          <div
            className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 pt-3 shadow-[0_-6px_16px_rgba(0,0,0,0.08)] backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-gray-700 dark:bg-gray-800/95"
            data-edit-bar
          >
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p
                className={`text-sm font-medium ${ruleError ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-200"}`}
                aria-live="polite"
              >
                {ruleError || (draftChanged ? "Unsaved changes." : "No changes yet.")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving || !draftChanged}
                  className="min-h-11 cursor-pointer rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-gray-800"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="min-h-11 cursor-pointer rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </form>

      {fixture ? null : (
      <section className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Last 30 days preview</h2>
          {previewing ? (
            <p className="text-sm text-gray-500 dark:text-gray-400" data-preview-updating aria-live="polite">
              Updating...
            </p>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400" aria-live="polite" data-preview-status>
          {previewStatus}
        </p>
        {driveTimesUpdating && !unsavedPin ? (
          <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200" aria-live="polite">
            Drive times are updating from your new address.
          </p>
        ) : null}
        {previewError ? (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{previewError}</p>
        ) : null}
        {preview ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
              {[
                ["Missions seen", preview.considered],
                ["Would accept", preview.wouldAccept],
                ["Would turn down", preview.wouldDecline],
                ["Can't tell", preview.unsure],
                ["Auto-accept off", preview.skipped],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-gray-50 px-3 py-3 dark:bg-gray-900/40">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
            {Object.keys(preview.reasons || {}).length > 0 ? (
              <ul className="mt-4 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {Object.entries(preview.reasons).map(([reason, count]) => (
                  <li key={reason}>
                    {count} — {REASON_LABELS[reason] || reason}
                  </li>
                ))}
              </ul>
            ) : null}
            {!previewError && preview.considered === 0 ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                No missions were first seen in the last 30 days.
              </p>
            ) : null}
            {!previewError && preview.considered > 0 ? (
              <>
              <div className="mt-4 space-y-3 sm:hidden" data-preview-cards>
                {preview.samples.map((sample) => {
                  const badge = CARD_DECISIONS[sample.decision] || {
                    label: sample.decision,
                    className: CARD_DECISIONS.skip.className,
                  };
                  return (
                    <article
                      key={sample.id || `${sample.externalMissionId}-${sample.firstSeenAt}`}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {sample.externalMissionId || sample.title || "Mission"}
                      </div>
                      {sample.address ? (
                        <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{sample.address}</div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
                        <span>Payout {money(sample.payout)}</span>
                        <span>Drive {minutes(sample.travelTime)}</span>
                      </div>
                      <div className="mt-2">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                        <ReasonChips sample={sample} fullWidth />
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="mt-4 hidden overflow-x-auto sm:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Mission</th>
                      <th className="py-2 pr-4 font-medium">Payout</th>
                      <th className="py-2 pr-4 font-medium">Drive</th>
                      <th className="py-2 font-medium">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-900 dark:text-gray-100">
                    {preview.samples.map((sample) => (
                      <tr key={sample.id || `${sample.externalMissionId}-${sample.firstSeenAt}`} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-2 pr-4">
                          <div>{sample.externalMissionId || sample.title || "Mission"}</div>
                          {sample.address ? (
                            <div className="text-gray-500 dark:text-gray-400">{sample.address}</div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-4">{money(sample.payout)}</td>
                        <td className="py-2 pr-4">{minutes(sample.travelTime)}</td>
                        <td className="py-2 align-top">
                          <div>{DECISION_LABELS[sample.decision] || sample.decision}</div>
                          <ReasonChips sample={sample} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            ) : null}
          </>
        ) : null}
      </section>
      )}
    </div>
  );
}
