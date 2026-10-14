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

  const data = await checkAddress(address);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ success: true, data });
}
