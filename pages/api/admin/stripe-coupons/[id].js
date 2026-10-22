import { requireAdmin } from "@/libs/adminRequest";
import { stripeWritesAllowed, updateServiceCoupon } from "@/libs/hub/stripe";
import { validateCouponInput } from "@/libs/hub/couponInput";

export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["PATCH"]);
  if (!session) return;
  if (!stripeWritesAllowed()) {
    return res.status(403).json({ error: "Forbidden", message: "Coupon changes are only enabled with a Stripe test-mode key." });
  }
  const id = String(req.query.id || "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return res.status(400).json({ error: "Invalid coupon" });
  const result = validateCouponInput(req.body, { partial: true });
  if (!result.ok) {
    return res.status(400).json({ error: "Invalid coupon", message: Object.values(result.errors)[0], fields: result.errors });
  }
  try {
    const coupon = await updateServiceCoupon(id, result.value);
    return res.status(200).json({ success: true, data: { id: coupon.id, replaced: coupon.replaced || null } });
  } catch (error) {
    console.error("Stripe coupon update error:", error?.message);
    return res.status(502).json({ error: "Stripe error", message: "Could not update the coupon" });
  }
}
