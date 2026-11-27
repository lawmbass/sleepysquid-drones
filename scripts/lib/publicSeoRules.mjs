import assert from "node:assert/strict";
import fs from "node:fs";
import { INDEXABLE_PATHS, SERVICE_NAV, SITE_ORIGIN } from "../../libs/publicPages.mjs";

const root = new URL("../../", import.meta.url);

function read(file) {
  return fs.readFileSync(new URL(file, root), "utf8");
}

function stripLineComments(source) {
  return source.replace(/^\s*\/\/.*$/gm, "");
}

/** Sentences that promise a same-day flight inside the DC FRZ. A denial does not count. */
export function sameDayFrzPromises(source) {
  return stripLineComments(source)
    .split(/[.\n;]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      if (!/same[- ]day/i.test(sentence)) return false;
      if (!/FRZ|Flight Restricted Zone/i.test(sentence)) return false;
      return !/\b(not|never|no|don'?t|do not|does not|cannot|can'?t|won'?t|will not)\b/i.test(sentence);
    });
}

const MARKETING_FILES = [
  "components/home/HeroSection.jsx",
  "components/home/PricingSection.jsx",
  "components/home/ServicesSection.jsx",
  "components/home/ContactSection.jsx",
  "components/home/BookingSection.jsx",
  "components/layout/Footer.jsx",
  "components/marketing/ServiceArticle.jsx",
  "pages/index.js",
  "pages/dc-frz-airspace.js",
  "pages/services/real-estate-drone-photography.js",
  "pages/services/roof-property-condition.js",
  "pages/services/construction-progress.js",
  "pages/services/event-aerials.js",
  "pages/services/mapping-3d.js",
  "libs/seo.js",
  "libs/publicPages.mjs",
  "config.js",
];

const PUBLISHED_PHONE = /\b(?:\+?1[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/;

function pageFile(href) {
  if (href === "/") return "pages/index.js";
  return `pages${href}.js`;
}

export function assertLocalSeo() {
  const index = read("pages/index.js");
  const hero = read("components/home/HeroSection.jsx");
  const footer = read("components/layout/Footer.jsx");
  const services = read("components/home/ServicesSection.jsx");
  const pricing = read("components/home/PricingSection.jsx");
  const seo = read("libs/seo.js");
  const seoCode = stripLineComments(seo);
  const robots = read("public/robots.txt");
  const sitemap = read("public/sitemap.xml");
  const roof = read("pages/services/roof-property-condition.js");
  const listing = read("pages/services/real-estate-drone-photography.js");
  const construction = read("pages/services/construction-progress.js");
  const events = read("pages/services/event-aerials.js");
  const mapping = read("pages/services/mapping-3d.js");
  const airspace = read("pages/dc-frz-airspace.js");

  assert.match(index, /<title>SleepySquid Drones \| Drone Photography &amp; Aerial Video in Washington, DC, MD &amp; VA<\/title>/);
  assert.match(index, /publicBookingSelection/);
  assert.match(hero, /Drone Photography &amp; Aerial Video Across Washington, DC, Maryland &amp; Virginia/);
  assert.match(hero, /Flyable Maryland &amp; Virginia suburbs, plus authorized operations in Washington, DC\./);
  assert.match(hero, /FAA Part 107 Certified &amp; Insured/);
  assert.match(hero, /\$1M liability coverage/);
  assert.match(footer, /© 2026 SleepySquid/);
  assert.match(footer, /SERVICE_NAV/);
  assert.match(services, /SERVICE_NAV/);

  for (const item of SERVICE_NAV) {
    assert.equal(INDEXABLE_PATHS.includes(item.href), true, `${item.href} missing from the sitemap list`);
    if (item.href.startsWith("/services/")) {
      assert.match(pricing, new RegExp(item.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }

  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Disallow: \/admin$/m);
  assert.match(robots, /^Disallow: \/api$/m);
  assert.match(robots, /^Sitemap: https:\/\/drones\.sleepysquid\.com\/sitemap\.xml$/m);

  for (const href of INDEXABLE_PATHS) {
    const loc = `${SITE_ORIGIN}${href === "/" ? "/" : href}`;
    assert.match(sitemap, new RegExp(`<loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>`));
    assert.equal(fs.existsSync(new URL(pageFile(href), root)), true, `${pageFile(href)} is missing`);
  }

  assert.match(seo, /tel:\+1XXXXXXXXXX/);
  assert.match(seo, /Never publish a personal mobile number/);
  assert.match(seo, /Do not add aggregateRating/);
  assert.match(seo, /areaServed: \["Washington, DC", "Maryland", "Virginia"\]/);
  assert.match(seo, /priceRange: "\$199 - \$1,200\+"/);
  assert.match(seoCode, /serviceType: \[[\s\S]*"Listing Photos"[\s\S]*"Listing Photos \+ Video"[\s\S]*"Roof & Property Condition"[\s\S]*"Construction Progress"[\s\S]*"Event Aerials"[\s\S]*"Mapping & 3D"[\s\S]*\]/);
  assert.doesNotMatch(seoCode, /aggregateRating|ratingValue|ratingCount|streetAddress|telephone\s*:|tel:|iPostal|4\.9|27 reviews/i);
  assert.doesNotMatch(seoCode, /areaServed:\s*"United States"/);

  assert.match(listing, /\$199/);
  assert.match(listing, /\$399/);
  assert.match(listing, /Best for listings/);
  assert.match(listing, /48-hour delivery/);
  assert.match(listing, /Travel within 25 miles of Burtonsville, MD/);
  assert.match(listing, /bookingHref\('real-estate', 'listing-photos'\)/);
  assert.match(listing, /bookingHref\('aerial-media', 'listing-video'\)/);

  assert.match(roof, /\$249/);
  assert.match(roof, /Photos only — not a licensed roof inspection, damage diagnosis, claim opinion, thermal scan, or roof measurement report\./);
  assert.match(roof, /Multi-building properties by quote; no towers, power lines, or utility infrastructure; return visits are a separate booking\./);
  assert.match(roof, /Travel within 25 miles of Burtonsville, MD/);
  assert.match(roof, /48-hour delivery/);
  assert.match(roof, /Commercial use license/);
  assert.match(roof, /Certificate of Insurance \(\$1M liability\) on request/);
  assert.match(roof, /bookingHref\('inspection', 'roof-property-condition'\)/);

  assert.match(construction, /\$350\/visit/);
  assert.match(construction, /\$650\/mo/);
  assert.match(construction, /\$1,200\/mo/);
  assert.match(construction, /repeatable GPS points and altitudes/);
  assert.match(construction, /1 overhead overview/);
  assert.match(construction, /Dated download folder within 48 hours/);
  assert.match(construction, /Commercial use license/);
  assert.match(construction, /Certificate of Insurance \(\$1M liability\) on request/);
  assert.match(construction, /bookingHref\('inspection', 'construction-single-visit'\)/);
  assert.match(construction, /bookingHref\('inspection', 'construction-monthly-2'\)/);
  assert.match(construction, /bookingHref\('inspection', 'construction-monthly-4'\)/);

  assert.match(events, /From \$500/);
  assert.match(events, /bookingHref\('event-coverage', 'event-aerials'\)/);
  assert.match(mapping, /From \$900/);
  assert.match(mapping, /bookingHref\('mapping-surveying', 'mapping-3d'\)/);

  assert.match(airspace, /Flight Restricted Zone/);
  assert.match(airspace, /Special Flight Rules Area/);
  assert.match(airspace, /flyable Maryland and Virginia suburbs/);
  assert.match(airspace, /SleepySquid does not offer same-day flights inside the FRZ\./);
  assert.deepEqual(sameDayFrzPromises(airspace), []);

  for (const file of MARKETING_FILES) {
    const source = read(file);
    const code = stripLineComments(source);
    assert.deepEqual(sameDayFrzPromises(source), [], `${file} promises a same-day FRZ flight`);
    assert.doesNotMatch(code, /aggregateRating|ratingValue|ratingCount|streetAddress|iPostal|tel:/i, file);
    assert.equal(PUBLISHED_PHONE.test(code), false, `${file} publishes a phone number`);
  }
}
