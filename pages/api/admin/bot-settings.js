import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import {
  HOME_PIN_REJECTED,
  classifyHomePin,
  homeAddressChanged,
  previewDecisions,
  sameHomePin,
  validateBotSettings,
} from "@/libs/botRules";
import { getBotSettings, previewBotSettings, saveBotSettings } from "@/libs/db/botSettings";
import { geocodeAddress, mapsApiKey } from "@/libs/geocode";

const rateLimitMiddleware = (req, res) => {
  return new Promise((resolve, reject) => {
    adminRateLimit(req, res, (result) => {
      if (result instanceof Error) {
        res.status(429).json({
          error: "Rate limit exceeded",
          message: "Too many admin requests. Please wait before trying again.",
        });
        return reject(result);
      }
      resolve();
    });
  });
};

function missingSettingsTable(error) {
  const code = String(error?.code || "");
  const message = `${error?.message || ""} ${error?.details || ""}`;
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (/bot_settings/i.test(message) && /schema cache|does not exist|could not find/i.test(message))
  );
}

function settingsUnavailable(res) {
  return res.status(503).json({
    error: "Bot rules unavailable",
    message:
      "The bot_settings table is not in the database yet. Apply supabase/migrations/20261013180000_bot_settings.sql, then reload this page.",
  });
}

async function buildPreview(settings) {
  try {
    return { preview: await previewBotSettings(settings), previewError: null };
  } catch (error) {
    if (missingSettingsTable(error)) throw error;
    console.error("Bot rules preview error:", error);
    return {
      preview: previewDecisions([], settings),
      previewError: "The last 30 days could not be loaded. The rules themselves are unchanged.",
    };
  }
}

async function resolveHomePin(settings, stored, pinSource) {
  const addressChanged = !stored || homeAddressChanged(stored.homeAddress, settings.homeAddress);
  const decision = classifyHomePin({
    addressChanged,
    pinSource,
    samePin: Boolean(stored && sameHomePin(stored, settings)),
  });

  if (decision.action === "keep") {
    return {
      ok: true,
      geocoded: false,
      settings: {
        ...settings,
        homeAddress: stored.homeAddress,
        homeLat: stored.homeLat,
        homeLng: stored.homeLng,
      },
    };
  }

  if (decision.action === "use-client") {
    return { ok: true, settings, geocoded: false };
  }

  if (decision.action === "reject") {
    return { ok: false, status: 400, message: decision.message };
  }

  if (mapsApiKey()) {
    const lookup = await geocodeAddress(settings.homeAddress);
    if (lookup.ok) {
      const formatted = lookup.formattedAddress;
      const homeAddress =
        formatted && formatted.length >= 8 && formatted.length <= 300 ? formatted : settings.homeAddress;
      return {
        ok: true,
        geocoded: true,
        settings: { ...settings, homeAddress, homeLat: lookup.lat, homeLng: lookup.lng },
      };
    }
    console.error("Home address geocode failed", lookup.reason);
  }

  return { ok: false, status: 400, message: HOME_PIN_REJECTED };
}

export default async function handler(req, res) {
  try {
    await rateLimitMiddleware(req, res);
  } catch (error) {
    return;
  }

  if (!["GET", "POST", "PUT"].includes(req.method)) {
    return res.status(405).json({
      error: "Method not allowed",
      message: "Only GET, POST, and PUT requests are allowed",
    });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required. Please sign in.",
    });
  }
  if (!adminConfig.isAdmin(session.user.email)) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Admin access required. Insufficient permissions.",
    });
  }

  try {
    if (req.method === "GET") {
      const settings = await getBotSettings();
      if (!settings) {
        return res.status(503).json({
          error: "Bot rules unavailable",
          message:
            "The bot_settings row is missing. Apply supabase/migrations/20261013180000_bot_settings.sql, then reload this page.",
        });
      }
      const { preview, previewError } = await buildPreview(settings);
      return res.status(200).json({
        success: true,
        data: {
          settings,
          mapsKeyConfigured: Boolean(mapsApiKey()),
          preview,
          previewError,
          previewSource: "saved",
        },
      });
    }

    const validated = validateBotSettings(req.body);
    if (!validated.ok) {
      return res.status(400).json({
        error: "Invalid bot rules",
        message: validated.errors[0].message,
        errors: validated.errors,
      });
    }

    if (req.method === "POST") {
      const { preview, previewError } = await buildPreview(validated.settings);
      return res.status(200).json({
        success: true,
        data: {
          settings: validated.settings,
          mapsKeyConfigured: Boolean(mapsApiKey()),
          preview,
          previewError,
          previewSource: "form",
        },
      });
    }

    const stored = await getBotSettings();
    const pinSource = req.body?.homePinSource === "place" || req.body?.homePinSource === "manual"
      ? req.body.homePinSource
      : "none";
    const pin = await resolveHomePin(validated.settings, stored, pinSource);
    if (!pin.ok) {
      return res.status(pin.status).json({
        error: "Invalid bot rules",
        message: pin.message,
        errors: [{ field: "homeAddress", message: pin.message }],
      });
    }

    const settings = await saveBotSettings(pin.settings, session.user.email);
    const { preview, previewError } = await buildPreview(settings);
    return res.status(200).json({
      success: true,
      message: pin.geocoded
        ? "Bot rules saved. The home pin was looked up from the new address."
        : "Bot rules saved.",
      data: {
        settings,
        mapsKeyConfigured: Boolean(mapsApiKey()),
        geocoded: pin.geocoded,
        preview,
        previewError,
        previewSource: "saved",
      },
    });
  } catch (error) {
    if (missingSettingsTable(error)) {
      return settingsUnavailable(res);
    }
    console.error("Admin bot settings error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to load or save bot rules",
    });
  }
}
