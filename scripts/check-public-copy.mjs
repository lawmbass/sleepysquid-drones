import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = new URL("..", import.meta.url);
const files = [
  "components/home/PricingSection.jsx",
  "components/home/BookingSection.jsx",
  "components/home/ServicesSection.jsx",
  "components/home/ContactSection.jsx",
  "components/home/HeroSection.jsx",
  "components/layout/Footer.jsx",
  "components/dashboard/ClientContent.jsx",
  "components/admin/BookingModal.jsx",
  "components/admin/BookingsList.jsx",
  "components/admin/AddBookingForm.jsx",
  "libs/seo.js",
  "libs/emailService.js",
  "pages/api/contact.js",
  "config.js",
  "libs/manualBooking.js",
  "README.md",
];

const banned = [
  /since 2020/i,
  /2-4 hours/i,
  /sports events/i,
  /all-inclusive/i,
  /Most Popular/,
  /survey-grade/i,
  /survey grade/i,
  /\binsured\b/i,
  /\binsurance\b/i,
  /Roof & Property Condition/,
  /Construction Progress/,
  /\$799/,
  /within 24 hours/i,
  /Basic Package/,
  /Standard Package/,
  /Premium Package/,
  /hour of flight/i,
  /within 25 miles/i,
];

for (const file of files) {
  const source = fs.readFileSync(new URL(file, root), "utf8");
  for (const pattern of banned) {
    assert.equal(pattern.test(source), false, `${file} still matches ${pattern}`);
  }
}

const pricing = fs.readFileSync(new URL("components/home/PricingSection.jsx", root), "utf8");
assert.match(pricing, /Listing Photos/);
assert.match(pricing, /Listing Photos \+ Video/);
assert.match(pricing, /Best for listings/);
assert.match(pricing, /Event Aerials/);
assert.match(pricing, /Mapping & 3D/);
assert.match(pricing, /from \$500|price: 500/);
assert.match(pricing, /price: 900/);
assert.match(pricing, /15-20 edited photos/);
assert.match(pricing, /48-hour delivery/);
assert.match(pricing, /up to 2 min/);
assert.match(pricing, /Add-ons on request/);
assert.match(pricing, /Raw files/);
assert.match(pricing, /Next-day delivery/);
assert.match(pricing, /Longer video edits/);
assert.match(pricing, /Travel fees may apply/);

const services = fs.readFileSync(new URL("components/home/ServicesSection.jsx", root), "utf8");
assert.match(services, /FAA Part 107 Certified/);

const booking = fs.readFileSync(new URL("components/home/BookingSection.jsx", root), "utf8");
assert.match(booking, /BOOKING_PACKAGES/);
assert.match(booking, /Add-ons on request/);

const client = fs.readFileSync(new URL("components/dashboard/ClientContent.jsx", root), "utf8");
assert.match(client, /BOOKING_PACKAGES/);
assert.match(client, /packageLabel/);
assert.match(client, /Add-ons on request/);
assert.match(client, /Travel fees may apply/);

const email = fs.readFileSync(new URL("libs/emailService.js", root), "utf8");
assert.match(email, /packageLabel/);
assert.match(email, /isQuotePackage/);
assert.match(email, /from /);

const readme = fs.readFileSync(new URL("README.md", root), "utf8");
assert.match(readme, /listing-photos/);
assert.match(readme, /previous tiers/);

const schema = fs.readFileSync(new URL("supabase/migrations/20261014050000_booking_package_tiers.sql", root), "utf8");
for (const id of ["listing-photos", "listing-video", "event-aerials", "mapping-3d", "basic", "standard", "premium"]) {
  assert.match(schema, new RegExp(`'${id}'`));
}

assert.equal(fs.existsSync(path.join(root.pathname, "components/home/PricingSection.jsx")), true);
console.log("public copy checks passed");
