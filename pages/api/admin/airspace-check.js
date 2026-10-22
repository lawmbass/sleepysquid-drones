import { requireAdmin } from "@/libs/adminRequest";
import { checkAddress } from "@/libs/airspaceCheck";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["POST"]);
  if (!session) return;

  const address = typeof req.body?.address === "string" ? req.body.address.trim() : "";
  if (address.length < 5 || address.length > 200) {
    return res.status(400).json({
      error: "Enter a street address.",
      message: "Use a full street address, up to 200 characters.",
    });
  }

  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  const picked =
    req.body?.lat != null && req.body?.lng != null && Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng, formattedAddress: address }
      : null;
  const data = await checkAddress(address, picked);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ success: true, data });
}
