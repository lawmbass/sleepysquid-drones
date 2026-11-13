// Admin actions for the referrals dashboard. Mail is injected so tests never hit Resend.
import {
  approvePayout, approveRequest, archiveRequest, createReferrer, declineRequest, listAdmin, setReferrerActive,
} from "./referralHub.mjs";
import { referrerLinks, sendReferrerLinkEmail } from "./referralEmail.mjs";

function emailStatus(email) {
  if (!email) return null;
  return {
    sent: !!email.sent,
    skipped: email.skipped || null,
    error: email.error || null,
    sentAt: email.sentAt || null,
    recorded: email.recorded !== false && !!email.sent,
  };
}

function withEmailStamp(referrer, email) {
  if (!email) return referrer;
  return {
    ...referrer,
    link_email_sent_at: email.sent ? email.sentAt : (referrer.link_email_sent_at || null),
    link_email_error: email.sent ? null : (email.error || referrer.link_email_error || null),
  };
}

async function mailed(db, referrer, opts) {
  const email = await sendReferrerLinkEmail(db, referrer, opts);
  return {
    referrer: withEmailStamp(referrer, email),
    links: email.links,
    email: emailStatus(email),
  };
}

export async function runReferralAdmin(db, opts) {
  const { method, body = {}, origin, secret, send, replyTo, now, connectConfigured, stripeTransfer } = opts || {};
  const mail = { origin, secret, send, replyTo, now };
  if (method === "GET") {
    const data = await listAdmin(db);
    const referrers = (data.referrers || []).map((row) => ({ ...row, links: referrerLinks(row, origin, secret) }));
    return { status: 200, body: { ...data, referrers, connectConfigured: !!connectConfigured } };
  }
  if (method !== "POST") return { status: 405, body: { error: "Method not allowed" } };
  const action = body.action;
  if (action === "create") {
    const referrer = await createReferrer(db, body);
    const sent = await mailed(db, referrer, mail);
    return { status: 201, body: sent };
  }
  if (action === "approve-request") {
    const result = await approveRequest(db, body.id);
    const sent = await mailed(db, result.referrer, mail);
    return { status: 200, body: { ...result, ...sent } };
  }
  if (action === "resend-link") {
    const rows = await db(`portal_referrers?id=eq.${encodeURIComponent(body.id || "")}&select=*`);
    const referrer = rows?.[0];
    if (!referrer) {
      const err = new Error("Referrer not found");
      err.status = 404;
      throw err;
    }
    const sent = await mailed(db, referrer, mail);
    return { status: 200, body: sent };
  }
  if (action === "decline-request") return { status: 200, body: { request: await declineRequest(db, body.id) } };
  if (action === "archive-request") return { status: 200, body: { request: await archiveRequest(db, body.id) } };
  if (action === "deactivate") return { status: 200, body: { referrer: await setReferrerActive(db, body.id, false) } };
  if (action === "reactivate") return { status: 200, body: { referrer: await setReferrerActive(db, body.id, true) } };
  if (action === "approve-payout") {
    const result = await approvePayout(db, { payoutId: body.id, stripeTransfer, connectConfigured: !!connectConfigured });
    return { status: 200, body: result };
  }
  return { status: 400, body: { error: "Unknown action" } };
}
