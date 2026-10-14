import { placesRateLimit } from "@/libs/rateLimit";
import { autocompletePlaces, isSessionToken, placesError } from "@/libs/places";

function limit(req, res) {
  return new Promise((resolve, reject) => {
    placesRateLimit(req, res, (result) => {
      if (result instanceof Error) {
        res.status(429).json({
          error: "Too many address searches",
          message: "Too many address searches. Please wait a few minutes and try again.",
        });
        reject(result);
        return;
      }
      resolve();
    });
  });
}

export default async function handler(req, res) {
  try {
    await limit(req, res);
  } catch {
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      message: "Only POST requests are allowed",
    });
  }

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
    console.error("Public places autocomplete failed", lookup.reason);
    const failure = placesError(lookup.reason);
    return res.status(failure.status).json({
      error: failure.body.error,
      code: failure.body.code,
      message: failure.body.code === "search_unavailable"
        ? "Address search isn't available right now."
        : "We couldn't look up that address. Try again.",
    });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ success: true, data: { suggestions: lookup.suggestions } });
}
