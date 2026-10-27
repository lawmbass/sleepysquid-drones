import { requireAdmin } from "@/libs/adminRequest";
import { INVITE_DAILY_MAX, inviteBlock, publicClient } from "@/libs/clients/core.mjs";
import { clientsReady, getClient, updateClient } from "@/libs/db/clients";
import { sendEmail } from "@/libs/mailgun";
import { aiLoginsFor, grantAiLogin } from "@/libs/clients/logins";

const PORTAL_LOGIN = "https://sleepysquid.com/login";

// Sends exactly one portal-invite email, only on an explicit click the admin confirmed
// (body.confirmEmail must equal the client's email). Rate-limited per client.
export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["POST"]);
  if (!session) return;
  if (!(await clientsReady())) return res.status(503).json({ error: "Not migrated" });
  const c = await getClient(String(req.query.id || ""));
  const client = c && publicClient(c);
  const block = inviteBlock(client);
  if (block) return res.status(block === "Client not found" ? 404 : 400).json({ error: "Can't invite", message: block });
  if (String(req.body?.confirmEmail || "").toLowerCase() !== client.email) return res.status(400).json({ error: "Confirm required", message: `Confirm: Email a portal invite to ${client.email}?` });
  if ((c.invite_sent_count || 0) >= INVITE_DAILY_MAX && c.last_invite_at && Date.now() - new Date(c.last_invite_at).getTime() < 864e5) return res.status(429).json({ error: "Too many invites", message: "Invite limit reached for today" });
  // Claim the slot first so a double click can't send twice.
  const now = new Date().toISOString();
  await updateClient(c.id, { last_invite_at: now, invited_at: c.invited_at || now, invite_sent_count: (c.invite_sent_count || 0) + 1 });
  try {
    const name = client.contactName || client.businessName;
    await sendEmail({
      to: client.email, fromName: "SleepySquid",
      subject: "Your SleepySquid client portal",
      text: `Hi ${name},\n\nYou've been invited to the SleepySquid client portal, where you can see your invoices${client.portalClientId ? " and your AI report" : ""}.\n\nSign in with this email address (${client.email}) at ${PORTAL_LOGIN}\n\nSleepySquid`,
    });
  } catch (error) {
    console.error("Invite email failed:", error?.message);
    return res.status(502).json({ error: "Email failed", message: "Could not send the invite" });
  }
  // AI clients: make sure the invited email can also open their AI report.
  try { await grantAiLogin(c); } catch (x) { console.error("AI login grant failed:", x?.message); }
  const row = await getClient(c.id);
  return res.status(200).json({ success: true, data: { client: publicClient(row, { aiLogins: await aiLoginsFor(row.portal_client_id).catch(() => []) }) } });
}
