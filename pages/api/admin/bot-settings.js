import { adminRateLimit } from "@/libs/rateLimit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import {
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

async function resolveHomePin(settings, stored) {
  const addressChanged = !stored || homeAddressChanged(stored.homeAddress, settings.homeAddress);
  if (!addressChanged) {
    return { ok: true, settings, geocoded: false };
  }

  if (mapsApiKey()) {
    const lookup = await geocodeAddress(settings.homeAddress);
    if (!lookup.ok) {
      const rejected = lookup.reason === "REQUEST_DENIED";
      return {
        ok: false,
        status: 400,
        message: rejected
          ? "The Maps key was rejected, so the new address was not saved. Check GOOGLE_MAPS_API_KEY, or remove it and enter the latitude and longitude yourself."
          : "That address could not be found on the map, so it was not saved. Check the spelling and try again.",
      };
    }
    return {
      ok: true,
      geocoded: true,
      settings: { ...settings, homeLat: lookup.lat, homeLng: lookup.lng },
    };
  }

  if (stored && sameHomePin(stored, settings)) {
    return {
      ok: false,
      status: 400,
      message:
        "The home address changed, and there is no Maps key on the server. Enter the latitude and longitude for the new address. The saved pin was not reused.",
    };
  }

  return { ok: true, settings, geocoded: false };
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
    const pin = await resolveHomePin(validated.settings, stored);
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
