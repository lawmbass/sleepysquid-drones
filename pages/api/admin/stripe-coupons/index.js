import { requireAdmin } from "@/libs/adminRequest";
import {
  createServiceCoupon,
  listCouponsWithServices,
  stripeConfigured,
  stripeWritesAllowed,
} from "@/libs/hub/stripe";
import { validateCouponInput } from "@/libs/hub/couponInput";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET", "POST"]);
  if (!session) return;

  if (req.method === "GET") {
    if (!stripeConfigured()) {
      return res.status(200).json({ success: true, data: { configured: false, writesAllowed: false, coupons: [] } });
    }
    try {
      const coupons = await listCouponsWithServices();
      return res.status(200).json({ success: true, data: { configured: true, writesAllowed: stripeWritesAllowed(), coupons } });
    } catch (error) {
      console.error("Stripe coupons list error:", error?.message);
      return res.status(502).json({ error: "Stripe unavailable", message: "Could not load Stripe coupons" });
    }
  }

  if (!stripeWritesAllowed()) {
    return res.status(403).json({ error: "Forbidden", message: "Coupon changes are only enabled with a Stripe test-mode key." });
  }
  const result = validateCouponInput(req.body);
  if (!result.ok) {
    return res.status(400).json({ error: "Invalid coupon", message: Object.values(result.errors)[0], fields: result.errors });
  }
  try {
    const coupon = await createServiceCoupon(result.value);
    return res.status(201).json({ success: true, data: { id: coupon.id } });
  } catch (error) {
    console.error("Stripe coupon create error:", error?.message);
    return res.status(502).json({ error: "Stripe error", message: "Could not create the coupon" });
  }
}
