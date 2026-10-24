import { requireAdmin } from "@/libs/adminRequest";
import { listGigSources, setGigSourceEnabled } from "@/libs/db/gigSources";
import {
  GIG_SOURCES_MIGRATION,
  knownSourceKeys,
  loadGigSourceView,
  parseSourceToggle,
  toggleSavedMessage,
  displayNameFor,
} from "@/libs/gigSources";

function unavailable(res) {
  return res.status(503).json({
    error: "Connected sources unavailable",
    message: `The gig_sources table is not in the database yet. Apply ${GIG_SOURCES_MIGRATION}, then try again. Zeitview stays enabled until then.`,
  });
}

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET", "PATCH"]);
  if (!session) return;

  try {
    const loaded = await listGigSources();
    if (req.method === "GET") {
      const view = await loadGigSourceView({ rows: loaded.rows, tableReady: loaded.tableReady });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ success: true, data: view });
    }

    if (!loaded.tableReady) return unavailable(res);

    const parsed = parseSourceToggle(req.body, knownSourceKeys(loaded.rows));
    if (!parsed.ok) {
      return res.status(400).json({
        error: "Invalid source",
        message: parsed.message,
      });
    }

    const saved = await setGigSourceEnabled({
      sourceKey: parsed.sourceKey,
      enabled: parsed.enabled,
      updatedBy: session.user.email,
      rows: loaded.rows,
    });
    if (!saved.tableReady) return unavailable(res);

    const again = await listGigSources();
    const view = await loadGigSourceView({
      rows: again.tableReady ? again.rows : saved.row ? [saved.row] : [],
      tableReady: again.tableReady,
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      message: toggleSavedMessage(displayNameFor(parsed.sourceKey, again.rows), parsed.enabled),
      data: view,
    });
  } catch (error) {
    console.error("Admin gig sources error:", error?.message || error);
    return res.status(500).json({
      error: "Internal server error",
      message: req.method === "GET"
        ? "Connected sources could not be loaded."
        : "Connected sources could not be saved.",
    });
  }
}
