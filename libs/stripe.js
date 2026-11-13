import Stripe from "stripe";
import { applyReferralToCheckoutCustomer } from "./referrals.mjs";
import { referralCouponId, referralDiscountDecision, referralDiscountPercent } from "./referralDiscount.mjs";

// This is used to create a Stripe Checkout for one-time payments. It's usually triggered with the <ButtonCheckout /> component. Webhooks are used to update the user's state in the database.
export const createCheckout = async ({
  priceId,
  mode,
  successUrl,
  cancelUrl,
  couponId,
  clientReferenceId,
  user,
  referrerCode,
  referrerEmail,
  stripe: stripeClient,
}) => {
  const stripe = stripeClient || new Stripe(process.env.STRIPE_SECRET_KEY);

  const extraParams = {};
  const attached = await applyReferralToCheckoutCustomer(stripe, { user, referrerCode });

  if (attached?.customerId) {
    extraParams.customer = attached.customerId;
    if (attached.created) {
      if (mode === "payment") {
        extraParams.invoice_creation = { enabled: true };
        extraParams.payment_intent_data = { setup_future_usage: "on_session" };
      }
      extraParams.tax_id_collection = { enabled: true };
      extraParams.customer_update = { name: "auto", address: "auto" };
    }
  } else if (user?.customerId) {
    extraParams.customer = user.customerId;
  } else {
    if (mode === "payment") {
      extraParams.customer_creation = "always";
      extraParams.invoice_creation = { enabled: true };
      extraParams.payment_intent_data = { setup_future_usage: "on_session" };
    }
    if (user?.email) {
      extraParams.customer_email = user.email;
    }
    extraParams.tax_id_collection = { enabled: true };
  }

  const decision = referralDiscountDecision({
    couponId: couponId || (referrerCode && referrerEmail ? referralCouponId() : ""),
    percent: referralDiscountPercent(),
    referrerEmail,
    customerEmail: user?.email,
  });
  const sessionParams = {
    mode,
    client_reference_id: clientReferenceId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...extraParams,
  };
  if (decision.apply) sessionParams.discounts = [{ coupon: decision.couponId }];
  else sessionParams.allow_promotion_codes = true;
  const stripeSession = await stripe.checkout.sessions.create(sessionParams);

  return stripeSession.url;
};

// This is used to create Customer Portal sessions, so users can manage their subscriptions (payment methods, cancel, etc..)
export const createCustomerPortal = async ({ customerId, returnUrl }) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return portalSession.url;
  } catch (e) {
    console.error(e);
    return null;
  }
};

// This is used to get the uesr checkout session and populate the data so we get the planId the user subscribed to
export const findCheckoutSession = async (sessionId) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });

    return session;
  } catch (e) {
    console.error(e);
    return null;
  }
};
