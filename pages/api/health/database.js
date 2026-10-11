import { pingBookings } from "@/libs/db/bookings";
import { SUPABASE_PROJECT_REF } from "@/libs/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
      message: "Only GET requests are allowed",
    });
  }

  const startTime = Date.now();

  try {
    await pingBookings();
    const connectionTime = Date.now() - startTime;

    return res.status(200).json({
      status: "healthy",
      database: "connected",
      provider: "supabase",
      projectRef: SUPABASE_PROJECT_REF,
      connectionTime: `${connectionTime}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const connectionTime = Date.now() - startTime;
    console.error("Database health check failed:", error.message);

    return res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
      provider: "supabase",
      projectRef: SUPABASE_PROJECT_REF,
      error: error.name,
      message: error.message,
      connectionTime: `${connectionTime}ms`,
      timestamp: new Date().toISOString(),
    });
  }
}
