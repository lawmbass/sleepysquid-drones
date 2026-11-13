import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { db, portalConfigured } from "@/libs/aiPortal/db";
import { stripeWritesAllowed } from "@/libs/hub/stripe";
import {
  approvePayout, approveRequest, archiveRequest, createReferrer, declineRequest, listAdmin, setReferrerActive, shareLinks, signReferrerToken,
} from "@/libs/referralHub.mjs";

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
  const origin = process.env.REFERRAL_PUBLIC_ORIGIN || "https://sleepysquid.com";
  const secret = process.env.REFERRAL_TOKEN_SECRET || "";
  try {
    if (req.method === "GET") {
      const data = await listAdmin(db);
      const referrers = data.referrers.map((row) => ({
        ...row,
        links: { ...shareLinks(row.code, origin), home: secret ? `${origin}/referrals/you/${signReferrerToken(row.id, secret)}` : "" },
      }));
      return res.status(200).json({ ...data, referrers, testMode: stripeWritesAllowed() });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const action = req.body?.action;
    if (action === "create") {
      const referrer = await createReferrer(db, req.body || {});
      const links = { ...shareLinks(referrer.code, origin), home: secret ? `${origin}/referrals/you/${signReferrerToken(referrer.id, secret)}` : "" };
      return res.status(201).json({ referrer, links });
    }
    if (action === "approve-request") return res.status(200).json(await approveRequest(db, req.body.id));
    if (action === "decline-request") return res.status(200).json({ request: await declineRequest(db, req.body.id) });
    if (action === "archive-request") return res.status(200).json({ request: await archiveRequest(db, req.body.id) });
    if (action === "deactivate") return res.status(200).json({ referrer: await setReferrerActive(db, req.body.id, false) });
    if (action === "reactivate") return res.status(200).json({ referrer: await setReferrerActive(db, req.body.id, true) });
    if (action === "approve-payout") {
      const result = await approvePayout(db, { payoutId: req.body.id, stripeTransfer, testMode: stripeWritesAllowed() });
      return res.status(200).json(result);
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("referral admin", err.message);
    return res.status(status).json({ error: status >= 500 ? "Something went wrong" : err.message });
  }
}
