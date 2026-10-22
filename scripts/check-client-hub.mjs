import assert from "node:assert/strict";

const { validateCouponInput } = await import("../libs/hub/couponInput.js");
const stripe = await import("../libs/hub/stripe.js");
import fs from "node:fs";

// Coupons never default to all services.
assert.equal(validateCouponInput({ name: "Spring", percentOff: 10 }).errors.services, "Choose at least one service");
assert.equal(validateCouponInput({ name: "Spring", percentOff: 10, services: ["pets"] }).errors.services, "Unknown service");
const ok = validateCouponInput({ name: "Spring", percentOff: 10, services: ["drones", "web"], code: "spring10" });
assert.equal(ok.ok, true);
assert.deepEqual(ok.value.services, ["drones", "web"]);
assert.equal(ok.value.code, "SPRING10");
assert.equal(validateCouponInput({ name: "x", services: ["ai"] }).ok, false); // no discount

// Writes only with a test key.
const saved = { a: process.env.STRIPE_HUB_SECRET_KEY, b: process.env.STRIPE_SECRET_KEY };
delete process.env.STRIPE_HUB_SECRET_KEY;
process.env.STRIPE_SECRET_KEY = "sk_live_example";
assert.equal(stripe.stripeWritesAllowed(), false);
await assert.rejects(() => stripe.createServiceCoupon({ services: ["ai"] }));
process.env.STRIPE_SECRET_KEY = "rk_test_example";
assert.equal(stripe.stripeWritesAllowed(), true);
process.env.STRIPE_SECRET_KEY = "";
assert.equal(stripe.stripeConfigured(), false);
if (saved.a !== undefined) process.env.STRIPE_HUB_SECRET_KEY = saved.a;
if (saved.b !== undefined) process.env.STRIPE_SECRET_KEY = saved.b;

// Navigation: Drones group, cross-service pages top level, same section URLs.
// userRoles imports app aliases, so check its source.
const roles = fs.readFileSync(new URL("../libs/userRoles.js", import.meta.url), "utf8");
const admin = roles.slice(roles.indexOf("case ROLES.ADMIN"), roles.indexOf("case ROLES.PILOT"));
const group = admin.slice(admin.indexOf("name: 'Drones'"), admin.indexOf("]", admin.indexOf("name: 'Drones'")));
for (const section of ["listings", "bot-rules", "airspace", "analytics"]) assert.ok(group.includes(`section=${section}'`), section);
const topLevel = admin.replace(group, "");
for (const section of ["bookings", "promos", "settings", "users"]) assert.ok(topLevel.includes(`section=${section}'`), section);

console.log("client hub checks passed");
const lines = await import("../libs/serviceLines.js");
assert.deepEqual(lines.SERVICE_LINE_IDS, ["drones", "ai", "web"]);
assert.equal(lines.serviceLineFromStripeTag("dispatch"), null);
assert.equal(validateCouponInput({ name: "x", percentOff: 5, services: ["dispatch"] }).ok, false);
assert.ok(!roles.includes("dispatch.sleepysquid.com"));
console.log("service line checks passed");
