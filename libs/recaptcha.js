// Shared reCAPTCHA v2 checkbox verification for public forms (bookings, contact).
// Logs Google's error-codes and hostname (never the secret or token) so a failure can be diagnosed.
export async function verifyRecaptcha(token, remoteip, fetchImpl = fetch) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { ok: false, status: 500, error: "reCAPTCHA not configured", message: "reCAPTCHA verification is required but not configured on the server" };
  if (!token) return { ok: false, status: 400, error: "Missing reCAPTCHA", message: "Please complete the reCAPTCHA verification" };
  try {
    const body = new URLSearchParams({ secret, response: String(token) });
    if (remoteip) body.set("remoteip", String(remoteip).split(",")[0].trim());
    const r = await fetchImpl("https://www.google.com/recaptcha/api/siteverify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
    const data = await r.json();
    if (!data.success) {
      const codes = data["error-codes"] || [];
      console.error("reCAPTCHA failed", { codes, hostname: data.hostname || null });
      if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) {
        return { ok: false, status: 500, error: "reCAPTCHA misconfigured", message: "Unable to verify reCAPTCHA right now. Please email us instead.", codes };
      }
      return { ok: false, status: 400, error: "reCAPTCHA verification failed", message: "Please try again with the reCAPTCHA verification", codes };
    }
    return { ok: true };
  } catch (e) {
    console.error("reCAPTCHA verification error:", e.message);
    return { ok: false, status: 500, error: "reCAPTCHA verification failed", message: "Unable to verify reCAPTCHA. Please try again." };
  }
}
