import { requireAdmin } from "@/libs/adminRequest";
import { autocompletePlaces, isSessionToken, placesError } from "@/libs/places";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["POST"]);
  if (!session) return;

  const input = String(req.body?.input || "").trim();
  const sessionToken = req.body?.sessionToken;
  if (input.length < 3 || input.length > 120 || !isSessionToken(sessionToken)) {
    return res.status(400).json({
      error: "Invalid address search",
      message: "Type a little more of the address, then choose it from the list.",
    });
  }

  const lookup = await autocompletePlaces(input, sessionToken);
  if (!lookup.ok) {
    console.error("Places autocomplete failed", lookup.reason, lookup.detail || "");
    const failure = placesError(lookup.reason);
    return res.status(failure.status).json(failure.body);
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ success: true, data: { suggestions: lookup.suggestions } });
}
