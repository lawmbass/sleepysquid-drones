# Public pricing and booking

Visitor-facing packages and the booking form on `/`.

## Sub-features

- Four packages in `#pricing`: Listing Photos (`$199`, service `real-estate`, package `listing-photos`), Listing Photos + Video (`$399`, badge `Best for listings`, service `aerial-media`, package `listing-video`), Event Aerials (quote, `from $500`, service `event-coverage`, package `event-aerials`), Mapping & 3D (quote, `$900`, service `mapping-surveying`, package `mapping-3d`).
- Add-ons line: Raw files, Next-day delivery, Longer video edits. Footer line on the section: `Travel fees may apply`.
- `Book This Package` scrolls to `#booking` and sets `#service` and `#package`.
- Booking steps: service and package, then `#date`, `#location` (US address autocomplete, which sets `placeId`), `#details`; step 2 is `#name`, `#email`, `#phone`; step 3 would show `Booking Submitted!` and a booking id.
- Contact form in `#contact` (`Send Message`) emails the team. It stores nothing in the database.
- Hero copy includes `FAA Part 107 Certified & Insured` and `$1M liability coverage`.

## How to get to it (user POV)

Open the site root. In the desktop nav, choose Pricing (`a[href="/#pricing"]`) or Book Now (`a[href="/#booking"]`). From the hero, Book a Service goes to `#booking`. Choosing a package fills the booking form. Next Step stays disabled until a service, a date at least two days out, and a selected US address are all set. Submit Booking is the step-2 button. The nav Login link points at `https://sleepysquid.com/login?from=drones`, which is the shared production login, not this local server. Use `/login` on the local origin instead, and do not complete it.

## Driving it with drive-pricing.mjs

```bash
node .cursor/skills/verify-sleepysquid-drones/scripts/drive-pricing.mjs
```

That opens `/`, clicks `a[href="/#pricing"]`, asserts the four `h3` names and the price strings, then clicks `Book This Package` on the card whose heading is exactly `Listing Photos`. It expects `#service=real-estate`, `#package=listing-photos`, and a disabled `Next Step`. It fails if any request leaves the machine or uses a method other than GET or HEAD.

Copy that must stay off the page is enforced by `node scripts/check-public-copy.mjs` (doctor runs it). Public service ids in the form must stay in the bookings API allow-list: `node --test scripts/tests/public-forms.test.mjs`.

Do not click `Submit Booking` or `Send Message`. Both call routes that write or email. Address autocomplete calls `/api/places/autocomplete`, which uses `GOOGLE_MAPS_API_KEY`. Leave that key unset, so a typed address never becomes a `placeId` and Next Step stays disabled. That is the end of the local journey.

## Gotchas

- `POST /api/bookings` rate-limits, checks reCAPTCHA, inserts into `bookings`, and can send a confirmation. A missing `RESEND_API_KEY` does not skip the Resend HTTP call.
- With no reCAPTCHA site key the contact form shows `reCAPTCHA is required but not configured` and does not submit. Do not add a site key to get past that.
- `GET /api/promo/active` runs on load of the banner, pricing, and booking sections. On this empty instance it errors and no promo prices are shown. A 200 from that route means a database answered. Stop.
- The homepage is still the right app when the hero says `Elevate Your Perspective with SleepySquid Drones`.
- `styles/globals.css` sets `scroll-behavior: smooth` on `html`. `scrollIntoView` then animates, and a screenshot taken immediately still shows the old position. Use `window.scrollTo({ top, behavior: "instant" })` or wait until the heading's `getBoundingClientRect().top` is inside the viewport. Pricing cards also stay at opacity 0 until they intersect the viewport.
