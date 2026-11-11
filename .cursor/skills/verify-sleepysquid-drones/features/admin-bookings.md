# Admin bookings

Customer and manual bookings on the admin dashboard.

## Sub-features

- List of bookings with status badges (`pending`, `confirmed`, `in-progress`, `completed`, `cancelled`) and a cancel-status badge when a linked gig has one.
- Add booking opens an inline form (`Add booking` / `Close`) titled `Add booking`. Fields follow `validateManualBooking` in `libs/manualBooking.js`: service, package, date at least two days out, location, details, name, email, phone, status, final price, admin notes. Source is stored as `manual`.
- Overview and analytics read the same job list as the dashboard: every booking, plus accepted `mission_listings` that have no `booking_id`. Cancelled listings, and bookings linked to them, drop out of that list. Cancel-requested gigs stay.

## How to get to it (user POV)

Sign in at `/login`. Admins (email in `ADMIN_EMAILS`, or ending in `@sleepysquid.com`, or stored role `admin`) land on `/dashboard`. In the sidebar, Bookings goes to `/dashboard?section=bookings`. The page heading is `Bookings Management`. The button label is `Add booking`. Saving posts to the admin bookings API and shows `Booking added.`

A signed-out visit to `/dashboard` redirects to `/login`. A signed-in non-admin who opens `section=bookings` is sent back to `/dashboard`.

## Driving it with the browser and check-admin-booking

On the default local server, stop at the login redirect. Do not create a user, do not post credentials, and do not call `POST /api/admin/bookings` or `POST /api/admin/bookings/create`.

The rules of the form, without a database, are `node scripts/check-admin-booking.mjs`. It checks the manual payload (source `manual`, email lowercased, final price, the two-day date rule, package names, and that mission fields such as `missionId` and `payout` are stripped).

Read-only API shape when you do have a session on a database you own: `GET /api/admin/bookings` is 401 with no session (doctor checks that) and 403 when the session is not an admin.

## Gotchas

- Customer rows require name, email, and phone. Mission rows may leave them null. Do not insert either kind from this skill.
- `scripts/check-earnings.mjs` covers how listings become jobs and when Cancel gig is hidden. It builds Gmail and mailto URLs as strings. It does not open them and it does not send mail. Running it is local. Clicking Cancel gig in the UI posts `/api/admin/listings/:id/cancel` and can queue a pilot email. Do not click it.
- `npm run check:rls` inserts a bookings probe when Supabase keys are present. Doctor runs the static half only.
