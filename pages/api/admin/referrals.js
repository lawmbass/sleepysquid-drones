import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { db, portalConfigured } from "@/libs/aiPortal/db";
import { stripeWritesAllowed } from "@/libs/hub/stripe";
import { sendEmail } from "@/libs/mailgun";
import { runReferralAdmin } from "@/libs/referralAdmin.mjs";

function sleepyAdmin(email) {
  return adminConfig.isAdmin(email) && String(email || "").toLowerCase().endsWith("@sleepysquid.com");
}

async function stripeTransfer(params, idempotencyKey) {
  const key = process.env.STRIPE_HUB_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "";
  const body = new URLSearchParams();
  body.set("amount", String(params.amount));
  body.set("currency", params.currency);
  body.set("destination", params.destination);
  for (const [name, value] of Object.entries(params.metadata || {})) body.set(`metadata[${name}]`, value);
  const response = await fetch("https://api.stripe.com/v1/transfers", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": idempotencyKey },
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(json?.error?.message || "Transfer failed");
    err.status = 502;
    throw err;
  }
  return json;
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Sign in required" });
  if (!sleepyAdmin(session.user.email)) return res.status(403).json({ error: "SleepySquid admin only" });
  if (!portalConfigured()) return res.status(503).json({ error: "Portal database is not configured" });
  try {
    const result = await runReferralAdmin(db, {
      method: req.method,
      body: req.body || {},
      origin: process.env.REFERRAL_PUBLIC_ORIGIN || "https://sleepysquid.com",
      secret: process.env.REFERRAL_TOKEN_SECRET || "",
      send: sendEmail,
      replyTo: "support@sleepysquid.com",
      testMode: stripeWritesAllowed(),
      stripeTransfer,
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("referral admin", err.message);
    return res.status(status).json({ error: status >= 500 ? "Something went wrong" : err.message });
  }
}
