import { useCallback, useEffect, useState } from "react";
import { DECISION_LABELS, REASON_LABELS, validateBotSettings } from "@/libs/botRules";

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

function Field({ id, label, help, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </label>
      <p id={`${id}-help`} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {help}
      </p>
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  "block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

export default function BotRulesSection() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [savedKey, setSavedKey] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mapsKeyConfigured, setMapsKeyConfigured] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [previewSource, setPreviewSource] = useState("saved");

  const applyResponse = useCallback((data, { replaceForm }) => {
    if (replaceForm && data.settings) {
      const next = formFromSettings(data.settings);
      setForm(next);
      setSavedKey(JSON.stringify(payloadFromForm(next)));
      setUpdatedAt(data.settings.updatedAt || null);
      setUpdatedBy(data.settings.updatedBy || null);
    }
    setMapsKeyConfigured(Boolean(data.mapsKeyConfigured));
    setPreview(data.preview || null);
    setPreviewError(data.previewError || "");
    setPreviewSource(data.previewSource || "saved");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/bot-settings", { credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || "Failed to load bot rules.");
      }
      applyResponse(body.data || {}, { replaceForm: true });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [applyResponse]);

  useEffect(() => {
    load();
  }, [load]);

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

  async function send(method) {
    const payload = payloadFromForm(form);
    const validated = validateBotSettings(payload);
    if (!validated.ok) {
      setFieldErrors(errorsByField(validated.errors));
      setNotice("");
      setError(validated.errors[0].message);
      return;
    }

    const busy = method === "PUT" ? setSaving : setPreviewing;
    busy(true);
    setError("");
    setNotice("");
    setFieldErrors({});
    try {
      const response = await fetch("/api/admin/bot-settings", {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFieldErrors(errorsByField(body.errors));
        throw new Error(body.message || "Could not update bot rules.");
      }
      applyResponse(body.data || {}, { replaceForm: method === "PUT" });
      if (method === "PUT") {
        setNotice(body.message || "Bot rules saved.");
      }
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      busy(false);
    }
  }

  const dirty = JSON.stringify(payloadFromForm(form)) !== savedKey;
  const describedBy = (id) => {
    const ids = [`${id}-help`];
    if (fieldErrors[id]) ids.push(`${id}-error`);
    return ids.join(" ");
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-600 dark:text-gray-300">Loading bot rules...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bot rules</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          These are the rules the drone-gigs bot reads before it accepts a mission. Saving here
          updates the single shared settings row.
        </p>
        {updatedAt ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Last saved {new Date(updatedAt).toLocaleString()}
            {updatedBy ? ` by ${updatedBy}` : ""}.
          </p>
        ) : null}
      </div>

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
        className="space-y-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800"
        onSubmit={(event) => {
          event.preventDefault();
          send("PUT");
        }}
      >
        <div>
          <p className="block text-sm font-medium text-gray-900 dark:text-white">Accept gigs automatically</p>
          <p id="autoAcceptEnabled-help" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Turn this off to keep recording missions the bot sees, without accepting them.
          </p>
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-900 dark:text-white">
            <input
              id="autoAcceptEnabled"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={form.autoAcceptEnabled}
              aria-describedby="autoAcceptEnabled-help"
              onChange={(event) => setField("autoAcceptEnabled", event.target.checked)}
            />
            Auto-accept is on
          </label>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field
            id="minPayoutUsd"
            label="Minimum payout (dollars)"
            help="Turn down a gig that pays less than this. Use 0 to 100,000."
            error={fieldErrors.minPayoutUsd}
          >
            <input
              id="minPayoutUsd"
              type="text"
              inputMode="decimal"
              className={inputClass}
              value={form.minPayoutUsd}
              aria-describedby={describedBy("minPayoutUsd")}
              aria-invalid={Boolean(fieldErrors.minPayoutUsd)}
              onChange={(event) => setField("minPayoutUsd", event.target.value)}
            />
          </Field>
          <Field
            id="longTripMinutes"
            label="Long trip starts at (minutes)"
            help="A drive this long, or longer, has to meet the higher payout. Use 1 to 1,440 (24 hours)."
            error={fieldErrors.longTripMinutes}
          >
            <input
              id="longTripMinutes"
              type="text"
              inputMode="numeric"
              className={inputClass}
              value={form.longTripMinutes}
              aria-describedby={describedBy("longTripMinutes")}
              aria-invalid={Boolean(fieldErrors.longTripMinutes)}
              onChange={(event) => setField("longTripMinutes", event.target.value)}
            />
          </Field>
          <Field
            id="longTripMinPayoutUsd"
            label="Long-trip minimum payout (dollars)"
            help="The least a long drive must pay. This cannot be lower than the regular minimum."
            error={fieldErrors.longTripMinPayoutUsd}
          >
            <input
              id="longTripMinPayoutUsd"
              type="text"
              inputMode="decimal"
              className={inputClass}
              value={form.longTripMinPayoutUsd}
              aria-describedby={describedBy("longTripMinPayoutUsd")}
              aria-invalid={Boolean(fieldErrors.longTripMinPayoutUsd)}
              onChange={(event) => setField("longTripMinPayoutUsd", event.target.value)}
            />
          </Field>
          <Field
            id="maxDriveMinutes"
            label="Maximum drive (minutes)"
            help="Leave blank for no maximum. A longer drive is never accepted. Use 1 to 1,440 if you set one."
            error={fieldErrors.maxDriveMinutes}
          >
            <input
              id="maxDriveMinutes"
              type="text"
              inputMode="numeric"
              className={inputClass}
              value={form.maxDriveMinutes}
              aria-describedby={describedBy("maxDriveMinutes")}
              aria-invalid={Boolean(fieldErrors.maxDriveMinutes)}
              onChange={(event) => setField("maxDriveMinutes", event.target.value)}
            />
          </Field>
          <Field
            id="dailyAcceptCap"
            label="Daily accept cap"
            help="The most gigs the bot may accept on one Eastern day. Leave blank for no cap. Use 1 to 48 if you set one."
            error={fieldErrors.dailyAcceptCap}
          >
            <input
              id="dailyAcceptCap"
              type="text"
              inputMode="numeric"
              className={inputClass}
              value={form.dailyAcceptCap}
              aria-describedby={describedBy("dailyAcceptCap")}
              aria-invalid={Boolean(fieldErrors.dailyAcceptCap)}
              onChange={(event) => setField("dailyAcceptCap", event.target.value)}
            />
          </Field>
          <Field
            id="minNoticeHours"
            label="Minimum notice (hours)"
            help="How long before the flight the bot must already have seen the gig. Leave blank to ignore notice. Use 0 to 168 if you set one. The preview only applies this when a real flight time is stored."
            error={fieldErrors.minNoticeHours}
          >
            <input
              id="minNoticeHours"
              type="text"
              inputMode="numeric"
              className={inputClass}
              value={form.minNoticeHours}
              aria-describedby={describedBy("minNoticeHours")}
              aria-invalid={Boolean(fieldErrors.minNoticeHours)}
              onChange={(event) => setField("minNoticeHours", event.target.value)}
            />
          </Field>
        </div>

        <Field
          id="homeAddress"
          label="Home address"
          help={
            mapsKeyConfigured
              ? "Drive time is measured from here. A changed address is looked up on the map when you save, and the pin below is replaced."
              : "Drive time is measured from here. No Maps key is set, so a changed address also needs a new latitude and longitude. The old pin is not reused."
          }
          error={fieldErrors.homeAddress}
        >
          <input
            id="homeAddress"
            type="text"
            className={inputClass}
            value={form.homeAddress}
            aria-describedby={describedBy("homeAddress")}
            aria-invalid={Boolean(fieldErrors.homeAddress)}
            onChange={(event) => setField("homeAddress", event.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field
            id="homeLat"
            label="Latitude"
            help="A number from -90 to 90. Filled in from the address when a Maps key is set."
            error={fieldErrors.homeLat}
          >
            <input
              id="homeLat"
              type="text"
              inputMode="decimal"
              className={inputClass}
              value={form.homeLat}
              aria-describedby={describedBy("homeLat")}
              aria-invalid={Boolean(fieldErrors.homeLat)}
              onChange={(event) => setField("homeLat", event.target.value)}
            />
          </Field>
          <Field
            id="homeLng"
            label="Longitude"
            help="A number from -180 to 180. Filled in from the address when a Maps key is set."
            error={fieldErrors.homeLng}
          >
            <input
              id="homeLng"
              type="text"
              inputMode="decimal"
              className={inputClass}
              value={form.homeLng}
              aria-describedby={describedBy("homeLng")}
              aria-invalid={Boolean(fieldErrors.homeLng)}
              onChange={(event) => setField("homeLng", event.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving || previewing}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save rules"}
          </button>
          <button
            type="button"
            disabled={saving || previewing}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
            onClick={() => send("POST")}
          >
            {previewing ? "Checking..." : "Preview last 30 days"}
          </button>
        </div>
      </form>

      <section className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Last 30 days preview</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {previewSource === "form"
            ? "This uses the rules in the form and the payout and drive time already stored on each mission. It does not recompute drive time from a new home address, and it is not saved until you press Save rules."
            : dirty
              ? "This uses the saved rules. Preview again to try the numbers currently in the form. Drive times already stored on each mission are used as-is."
              : "This uses the saved rules, the stored payout, and the stored drive time. A new home address does not recompute old drives. Nothing is changed."}
        </p>
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
              <div className="mt-4 overflow-x-auto">
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
                        <td className="py-2">
                          <div>{DECISION_LABELS[sample.decision] || sample.decision}</div>
                          {sample.reason ? (
                            <div className="text-gray-500 dark:text-gray-400">
                              {REASON_LABELS[sample.reason] || sample.reason}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
