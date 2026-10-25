import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyRecaptcha } from "../../libs/recaptcha.js";

test("every public booking service id is accepted by /api/bookings", () => {
  const ui = readFileSync("components/home/BookingSection.jsx", "utf8");
  const api = readFileSync("pages/api/bookings.js", "utf8");
  const ids = [...ui.slice(0, ui.indexOf("];")).matchAll(/id: '([^']+)'/g)].map((m) => m[1]);
  const valid = api.match(/validServices = \[([\s\S]*?)\]/)[1];
  assert.ok(ids.length >= 6);
  for (const id of ids) assert.ok(valid.includes(`'${id}'`), `${id} missing from API validServices`);
});

test("verifyRecaptcha: url-encodes, maps errors, never ok on failure", async () => {
  process.env.RECAPTCHA_SECRET_KEY = "s&x";
  let sent;
  const ok = await verifyRecaptcha("t+/=", "1.2.3.4, 5", async (_u, o) => { sent = new URLSearchParams(o.body); return { json: async () => ({ success: true }) }; });
  assert.equal(ok.ok, true); assert.equal(sent.get("secret"), "s&x"); assert.equal(sent.get("response"), "t+/="); assert.equal(sent.get("remoteip"), "1.2.3.4");
  const bad = await verifyRecaptcha("t", null, async () => ({ json: async () => ({ success: false, "error-codes": ["invalid-input-secret"] }) }));
  assert.equal(bad.status, 500);
  const dup = await verifyRecaptcha("t", null, async () => ({ json: async () => ({ success: false, "error-codes": ["timeout-or-duplicate"] }) }));
  assert.equal(dup.status, 400);
  assert.equal((await verifyRecaptcha("", null)).status, 400);
  delete process.env.RECAPTCHA_SECRET_KEY;
  assert.equal((await verifyRecaptcha("t", null)).status, 500);
});
