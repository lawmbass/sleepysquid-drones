import { requireAdmin } from "@/libs/adminRequest";
import { loadPreviewListings } from "@/libs/db/botSettings";
import { computePreviewDriveTimes, storedDrivesMatch } from "@/libs/driveTimes";

function coordinate(value, min, max) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < min || amount > max) return null;
  return amount;
}

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["POST"]);
  if (!session) return;

  const homeLat = coordinate(req.body?.homeLat, -90, 90);
  const homeLng = coordinate(req.body?.homeLng, -180, 180);
  if (homeLat == null || homeLng == null || (homeLat === 0 && homeLng === 0)) {
    return res.status(400).json({
      error: "Invalid home pin",
      message: "A home latitude and longitude are required.",
    });
  }

  try {
    const listings = await loadPreviewListings({ minNoticeHours: null });
    const computed = await computePreviewDriveTimes({ lat: homeLat, lng: homeLng }, listings);
    if (!computed.ok) {
      const unavailable = computed.reason === "no_key" || computed.reason === "denied";
      return res.status(unavailable ? 503 : 502).json({
        error: "Drive times unavailable",
        message: "Drive times from that pin could not be checked.",
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      data: {
        matchesStored: storedDrivesMatch(listings, computed.byId),
        capped: computed.capped,
        calls: computed.calls,
        considered: listings.length,
        drives: listings.map((listing) => {
          const result = computed.byId.get(listing.id);
          const usable = result && result.source !== "capped" && result.source !== "error";
          return {
            id: listing.id,
            travelTime: usable ? result.minutes : null,
            storedTravelTime: listing.travelTime,
            source: result?.source || "missing",
          };
        }),
      },
    });
  } catch (error) {
    console.error("Draft drive times error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Drive times could not be checked.",
    });
  }
}
