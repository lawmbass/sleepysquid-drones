import { requireAdmin } from "@/libs/adminRequest";
import { buildHubOverview } from "@/libs/hub/overview";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET"]);
  if (!session) return;
  try {
    const overview = await buildHubOverview();
    return res.status(200).json({ success: true, data: overview });
  } catch (error) {
    console.error("Hub overview error:", error?.message);
    return res.status(500).json({ error: "Internal server error", message: "Failed to load overview" });
  }
}
