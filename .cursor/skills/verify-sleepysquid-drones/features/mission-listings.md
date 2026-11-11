# Mission listings

Every gig the bot has seen, in the admin dashboard.

## Sub-features

- Source tabs in `role="tablist"` `aria-label="Filter by source"`: All, Zeitview, FlyGuys, Droners. Each tab shows a count once aggregates load.
- Filters: search placeholder `Search title, address, id`; status select (All statuses, Seen, Needs review, Accepted, Declined by filter, Expired, Unavailable, Deleted); placeholders `Mission type`, `Equipment or certification`, `Min payout`, `Max distance (miles)`; date input `aria-label="Deadline from"`.
- A row opens the detail (requirements, flight-plan steps, raw detail). Aggregates sit above the filters.
- Soft-deleted listings are the Deleted filter. Restore is a separate admin action.

## How to get to it (user POV)

Sign in as an admin and open Drones, then Listings, which is `/dashboard?section=listings`. The old `/admin/bot-rules` path redirects to `/dashboard?section=bot-rules`, not to listings. The list loads from `GET /api/admin/listings`. Opening one listing uses `GET /api/admin/listings/:id`.

## Driving it with the browser

Doctor already checks that `GET /api/admin/listings` is 401 when signed out. That is as far as the default local server can go: the page itself redirects to `/login` before the filters render.

Do not sign in against production to reach the filters. Do not `POST /api/admin/listings/:id/cancel` and do not call restore. Source-tab and search behavior is covered in memory by `node scripts/check-gig-sources.mjs` and `node --test scripts/tests/listing-sources.test.mjs scripts/tests/listing-status.test.mjs scripts/tests/listing-lifecycle.test.mjs scripts/tests/listings-imports.test.mjs`.

When you are on a database you created yourself, the handles above are the ones to click. After a filter change the list query includes that field. A cancelled listing leaves the overview job list; a cancel-requested one stays. Confirm that in the API JSON, not by sending a cancel email.

## Gotchas

- `external_mission_id` is not format-checked, so declined gigs with non-DBM ids still store. Booking `mission_id` must match `^DBM[0-9]+$` when set.
- `status = accepted` alone does not show Cancel gig. The button needs a recorded acceptance and a gig that is still pending. The visibility rules are in `libs/cancelGig.js` and asserted by `scripts/check-earnings.mjs`.
- `scripts/backfill-mission-type.mjs` reads every listing with a null `mission_type` and `--apply` updates them. Do not run it.
