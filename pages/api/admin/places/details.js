import { requireAdmin } from "@/libs/adminRequest";
import { isPlaceId, isSessionToken, placeDetails, placesError } from "@/libs/places";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["POST"]);
  if (!session) return;

  const placeId = req.body?.placeId;
  const sessionToken = req.body?.sessionToken;
  if (!isPlaceId(placeId) || !isSessionToken(sessionToken)) {
    return res.status(400).json({
      error: "Invalid address search",
      message: "That suggestion expired. Type the address again and choose it from the list.",
    });
  }

  const lookup = await placeDetails(placeId, sessionToken);
  if (!lookup.ok) {
    console.error("Place details failed", lookup.reason);
    const failure = placesError(lookup.reason);
    return res.status(failure.status).json(failure.body);
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    success: true,
    data: {
      formattedAddress: lookup.formattedAddress,
      lat: lookup.lat,
      lng: lookup.lng,
    },
  });
}
