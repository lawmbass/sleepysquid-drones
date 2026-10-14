import { requireAdmin } from "@/libs/adminRequest";
import { insertBooking } from "@/libs/db/bookings";
import { validateManualBooking } from "@/libs/manualBooking";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["POST"]);
  if (!session) return;

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  const result = validateManualBooking(req.body);
  if (!result.ok) {
    return res.status(400).json({
      error: "Invalid booking",
      message: Object.values(result.errors)[0],
      fields: result.errors,
    });
  }

  try {
    const booking = await insertBooking(result.value);
    return res.status(201).json({
      success: true,
      data: { booking },
    });
  } catch (error) {
    console.error("Admin booking create error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to add booking",
    });
  }
}
