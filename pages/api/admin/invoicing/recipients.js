import { requireAdmin } from "@/libs/adminRequest";
import { searchRecipients } from "@/libs/invoicing/recipients";

/** Invoice recipient type-ahead: client accounts (never admins) and AI clients. */
export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET"]);
  if (!session) return;
  try {
    const recipients = await searchRecipients(String(req.query.q || ""), 8);
    return res.status(200).json({ success: true, data: { recipients } });
  } catch (error) {
    console.error("Recipient search error:", error?.message);
    return res.status(500).json({ error: "Server error", message: "Could not search clients" });
  }
}
