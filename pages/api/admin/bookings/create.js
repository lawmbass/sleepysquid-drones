import { requireAdmin } from "@/libs/adminRequest";
import { bookingAddressError, resolveUsBookingAddress } from "@/libs/bookingAddress";
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

  const address = await resolveUsBookingAddress({
    placeId: req.body?.placeId,
    location: result.value.location,
  });
  if (!address.ok) {
    const failure = bookingAddressError(address.reason);
    return res.status(failure.status).json({
      error: "Invalid location",
      message: failure.message,
    });
  }

  try {
    const booking = await insertBooking({
      ...result.value,
      location: address.location,
      coordinates: { lat: address.lat, lng: address.lng },
    });
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
