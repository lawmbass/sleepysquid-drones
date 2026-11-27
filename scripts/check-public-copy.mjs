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
  /fully insured/i,
  /\bbonded\b/i,
  /skywatch/i,
  /\bhull\b/i,
  /policy number/i,
  /equipment coverage/i,
  /\$799/,
  /within 24 hours/i,
  /Basic Package/,
  /Standard Package/,
  /Premium Package/,
  /hour of flight/i,
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
assert.match(pricing, /Roof & Property Condition/);
assert.match(pricing, /Construction Progress/);
assert.match(pricing, /price: 249/);
assert.match(pricing, /price: 350/);
assert.match(pricing, /price: 650/);
assert.match(pricing, /price: 1200/);
assert.match(pricing, /per structure/);
assert.match(pricing, /\/visit/);
assert.match(pricing, /2 visits\/mo/);
assert.match(pricing, /4 visits\/mo/);
assert.match(pricing, /within 25 miles of Burtonsville, MD/);
assert.match(pricing, /ROOF_DISCLAIMER_LINES/);
assert.match(pricing, /plan\.disclaimer/);
assert.match(pricing, /lg:grid-cols-3/);
assert.doesNotMatch(pricing, /xl:grid-cols-4/);
assert.doesNotMatch(pricing, /buy\.stripe\.com/);

const packages = fs.readFileSync(new URL("libs/manualBooking.js", root), "utf8");
assert.match(packages, /roof-property-condition/);
assert.match(packages, /construction-single-visit/);
assert.match(packages, /construction-monthly-2/);
assert.match(packages, /construction-monthly-4/);
assert.match(packages, /Photos only — not a licensed roof inspection, damage diagnosis, claim opinion, thermal scan, or roof measurement report\./);
assert.match(packages, /Multi-building properties by quote; no towers, power lines, or utility infrastructure; return visits are a separate booking\./);
assert.match(packages, /Add-ons \(raw files, next-day delivery, short video, extra travel\) on request\./);

const stripePlans = fs.readFileSync(new URL("config.js", root), "utf8");
assert.match(stripePlans, /price_1UgRxMIWY3TabuKuTm7rRq6Y/);
assert.match(stripePlans, /drones_roof_property_condition/);
assert.match(stripePlans, /prod_VhrgOne8EuLSy0/);
assert.match(stripePlans, /price_1UgRxOIWY3TabuKu2sARh9CU/);
assert.match(stripePlans, /drones_construction_single_visit/);
assert.match(stripePlans, /price_1UgRxQIWY3TabuKuxh4UKDt0/);
assert.match(stripePlans, /drones_construction_monthly_2/);
assert.match(stripePlans, /price_1UgRxWIWY3TabuKupIGLcJ23/);
assert.match(stripePlans, /drones_construction_monthly_4/);
assert.match(stripePlans, /prod_Vhrg4hqvIvsliu/);
assert.doesNotMatch(stripePlans, /buy\.stripe\.com/);

const services = fs.readFileSync(new URL("components/home/ServicesSection.jsx", root), "utf8");
assert.match(services, /FAA Part 107 Certified &(?:amp;)? Insured/);
assert.match(services, /\$1M liability coverage/);

const claim = /FAA Part 107 Certified &(?:amp;)? Insured/;
const liability = /\$1M liability coverage/;
for (const file of [
  "components/home/HeroSection.jsx",
  "components/layout/Footer.jsx",
  "components/home/BookingSection.jsx",
  "components/home/ContactSection.jsx",
  "components/dashboard/ClientContent.jsx",
  "pages/index.js",
  "config.js",
  "libs/emailService.js",
]) {
  const source = fs.readFileSync(new URL(file, root), "utf8");
  assert.match(source, claim, `${file} is missing the certification line`);
  assert.match(source, liability, `${file} is missing the liability line`);
}

const booking = fs.readFileSync(new URL("components/home/BookingSection.jsx", root), "utf8");
assert.match(booking, /BOOKING_PACKAGES/);
assert.match(booking, /Add-ons on request/);
assert.match(booking, /disclaimer/);

const client = fs.readFileSync(new URL("components/dashboard/ClientContent.jsx", root), "utf8");
assert.match(client, /BOOKING_PACKAGES/);
assert.match(client, /packageLabel/);
assert.match(client, /Add-ons on request/);
assert.match(client, /Travel fees may apply/);
assert.match(client, /disclaimer/);

const email = fs.readFileSync(new URL("libs/emailService.js", root), "utf8");
assert.match(email, /packageLabel/);
assert.match(email, /formatBookingPrice/);

const readme = fs.readFileSync(new URL("README.md", root), "utf8");
assert.match(readme, /listing-photos/);
assert.match(readme, /previous tiers/);

const schema = fs.readFileSync(new URL("supabase/migrations/20261014050000_booking_package_tiers.sql", root), "utf8");
for (const id of ["listing-photos", "listing-video", "event-aerials", "mapping-3d", "basic", "standard", "premium"]) {
  assert.match(schema, new RegExp(`'${id}'`));
}

const packageIds = [
  "basic",
  "standard",
  "premium",
  "listing-photos",
  "listing-video",
  "event-aerials",
  "mapping-3d",
  "roof-property-condition",
  "construction-single-visit",
  "construction-monthly-2",
  "construction-monthly-4",
];
const roofMigration = fs.readFileSync(new URL("supabase/migrations/20261127170000_booking_roof_construction_packages.sql", root), "utf8");
assert.match(roofMigration, /bookings_package_check/);
for (const id of packageIds) {
  assert.match(roofMigration, new RegExp(`'${id}'`));
}

assert.equal(fs.existsSync(path.join(root.pathname, "components/home/PricingSection.jsx")), true);
console.log("public copy checks passed");
