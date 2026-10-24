# SleepySquid Drones

Professional drone services website with an admin dashboard. The site runs on Next.js (pages router) and stores data in Supabase Postgres.

Production: https://drones.sleepysquid.com  
Supabase project: `etbesmtdsjlmadaexvrv` (`https://etbesmtdsjlmadaexvrv.supabase.co`)

The Atlas cluster is gone. There is no data to migrate. Apply the SQL migration once and start with empty tables.

## Quick setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment variables

Required for the app and the health check:

```env
NEXT_PUBLIC_SUPABASE_URL=https://etbesmtdsjlmadaexvrv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
GOOGLE_ID=
GOOGLE_SECRET=
ADMIN_EMAILS=you@sleepysquid.com
```

Production `NEXTAUTH_URL` is `https://drones.sleepysquid.com`. `SITE_URL` should match.

Also used when those features are on: reCAPTCHA, Mailgun, Stripe, OpenAI, SMTP. See `.env.example`. Do not commit `.env` or any real keys.

`SUPABASE_SERVICE_ROLE_KEY` is server-only. API routes import it after a session check. Do not put it in `NEXT_PUBLIC_*` or in client components.

## Apply the database

One migration, applied once, in this order (the file does it for you):

1. `admin_allowlist` and `public.is_dashboard_admin()`
2. `users`
3. `oauth_accounts`
4. `bookings`
5. `promos`
6. `invitations`
7. `rate_limit_events`
8. `mission_listings`
9. Row level security and grants

In the Supabase SQL editor, paste `supabase/migrations/20261011120000_initial_schema.sql` and run it. Or use the Supabase CLI against this project. This repo does not apply the migration for you.

`npm run check:rls` checks the SQL (RLS on every table, no always-true policies, anon cannot read bookings or listings). If the three Supabase env vars are set, it also probes the live project. Without keys it only runs the static check.

## Auth

Sign-in stays on **NextAuth** (JWT sessions): Google plus email and password. Supabase Auth is not used. Leave the Google and email providers disabled in the Supabase dashboard. Site URL and redirect allow-lists in Supabase Auth are unused. Setting Site URL to `https://drones.sleepysquid.com` is harmless if you set it anyway.

Users live in `public.users`. Google accounts are linked in `public.oauth_accounts` during the NextAuth `signIn` callback.

### Admin rules

- An email is an admin when it is listed in `ADMIN_EMAILS` or it ends with `@sleepysquid.com` (case-insensitive). Account creation and every sign-in store `role = admin` for those addresses.
- The dashboard uses that same check, plus a stored `admin` role. API admin routes return 401 with no session, then 403 unless `adminConfig.isAdmin` is true.
- Middleware lets any `@sleepysquid.com` address into dashboard pages even when `hasAccess` is false. Other users with `hasAccess` false go to `/access-denied`.
- A non-admin who opens an admin section (`bookings`, `listings`, `bot-rules`, `promos`, `analytics`, `users`) is sent back to `/dashboard`.
- Protected pages: `/dashboard`, `/admin`, `/profile`, `/settings`. `/` matches exactly, so it no longer treats every path as public. `/api/*` is never redirected to login; handlers keep returning 401.

`public.is_dashboard_admin()` is true when a Supabase JWT email ends with `@sleepysquid.com` or is in `admin_allowlist` (starts empty). NextAuth does not issue Supabase JWTs, so the website uses the service role after its own session check. The RLS policies are what a direct PostgREST client would hit.

### Google Cloud (NextAuth)

Authorized JavaScript origins:

- `https://drones.sleepysquid.com`
- `http://localhost:3000`

Authorized redirect URIs:

- `https://drones.sleepysquid.com/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/google`

### Supabase dashboard

1. Project Settings → API: copy the project URL, the anon key, and the service role key into the three env vars above.
2. Run the SQL migration once.
3. Do not enable Supabase Auth providers. This app does not use them.

## Features

**Public site** (`/`)

- Portfolio, pricing, contact form (email only; nothing is stored)
- Booking form with reCAPTCHA. Public inserts are customer bookings at least two days out.

**Dashboard** (`/dashboard`)

- Bookings, mission analytics, promos, users. Analytics opens on All time. Last 7 days, 30 days, 90 days, and 1 year sit beside it. Every total uses the event date, so a job with no event date is left out.
- **Listings**: every DroneBase/Zeitview mission the bot has seen, with filters, a detail view (requirements and flight-plan steps), and aggregates
- **Bot rules**: one shared set of acceptance rules in `bot_settings` for every connected gig source. Admins edit them here. The bot reads the same row. Connected sources are Zeitview (on), FlyGuys, and Droners.io (both off until an admin enables them).
- Overview stats, the recent jobs list, and analytics all read one job list: every booking, plus accepted `mission_listings` with no `booking_id`. Those listings count as completed Zeitview jobs. A listing that already has a booking is not counted again. The recent-jobs count is the length of that list. A listing's job date is the scraped flight date in `raw_detail` (schedule / parsed schedule / "flight date and time"), then `.mission-date` plus `.mission-time` in `raw_detail.html`, then an unlabeled `MM/DD/YYYY` and `HH:MM AM` in `raw_detail.text` (the pair just before "You must arrive on time"; a space before AM/PM is fine), then a Zeitview confirmation or reschedule sentence in `raw_email_text` or the stored page ("Your flight is scheduled for" / "Your flight has been rescheduled for"), then `due_window_start`, then `deadline`, then `due_window_end`. Page times with no zone are US Eastern. `created_at`, `first_seen_at`, and `last_seen_at` are never the event date. When none of the flight sources exist, the date is blank. A listing with `cancel_status = cancelled`, and a booking linked to that listing, is left out of this list. Cancel-requested gigs stay in.

## drone-gigs

`lawmbass/drone-gigs` writes with the same `SUPABASE_SERVICE_ROLE_KEY` against this project. It no longer uses `MONGODB_URI`.

### `public.bookings` (accepted missions and customer bookings)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | `gen_random_uuid()` |
| `source` | text | `customer` (default), `zeitview`, `manual`, `flyguys`, or `droners` |
| `service` | text | Required, non-blank. Not limited to the website enum, so the bot is not blocked by it. |
| `package` | text | `listing-photos`, `listing-video`, `event-aerials`, `mapping-3d`, or null. Older rows may still be `basic`, `standard`, or `premium`. Those stay valid and display as previous tiers. |
| `mission_id` | text | Unique. Null for customers. Must match `^DBM[0-9]+$` when set. Duplicate insert is Postgres `23505` on `bookings_mission_id_key`; skip that mission. |
| `payout` | numeric(12,2) | USD. Null allowed. |
| `travel_distance` | numeric(12,2) | Miles |
| `travel_time` | numeric(12,2) | Minutes |
| `duration` | numeric(12,2) | Minutes, nullable |
| `accepted_at` | timestamptz | When the bot accepted the mission |
| `mission_email` | text | Original email |
| `latitude`, `longitude` | numeric(9,6) | Optional |
| `date` | timestamptz | Required |
| `location` | text | Required, 1–200 chars |
| `details` | text | Default `''`, max 1000 |
| `name`, `email`, `phone` | text | Required when `source = 'customer'`. Mission rows may leave them null. |
| `estimated_price`, `final_price` | numeric(12,2) | Customer prices |
| `applied_promo` | jsonb | Optional |
| `status` | text | `pending`, `confirmed`, `in-progress`, `completed`, `cancelled` |
| `ip_address`, `user_agent` | text | Optional |
| `admin_notes` | text | Default `''`, max 500 |
| `created_at`, `updated_at` | timestamptz | `updated_at` is maintained by a trigger |

Bot insert example: `source: 'zeitview'`, `service`, `mission_id`, `payout`, `location`, `travel_distance`, `travel_time`, `date`, `duration`, `accepted_at`, `admin_notes`, `mission_email`. Set `status` to `confirmed` for an auto-accept.

### `public.mission_listings` (every mission the bot sees)

One row per mission. Unique on `(source, external_mission_id)` (`mission_listings_source_external_unique`). Upsert with `onConflict: 'source,external_mission_id'`.

Set `first_seen_at` only on insert. Later sightings update `last_seen_at` and the descriptive fields. **Do not send `admin_notes`, `tags`, `cancel_status`, `cancel_reason`, `cancel_requested_at`, or `cancelled_at`.** Those belong to the dashboard. Set `bot_accepted_at` only on the accept write, to the same instant as `bookings.accepted_at`. Omit it on later sightings and on the completed-mission backfill. Supabase upsert writes only the keys in the payload, so leaving them out leaves the stored values alone. When a mission is accepted, set `status` to `accepted` and `booking_id` to the `bookings.id` you just inserted.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `source` | text | Required, non-blank (for example `zeitview`) |
| `external_mission_id` | text | Required. Not format-checked, so declined gigs with non-DBM ids still store. |
| `first_seen_at` | timestamptz | Default `now()`. Do not overwrite. |
| `last_seen_at` | timestamptz | Update on every sighting. |
| `status` | text | `seen` (default), `accepted`, `declined_by_filter`, `expired`, `unavailable` |
| `decline_reason` | text | Which acceptance rule failed, for example `payout_below_minimum` |
| `title` | text | |
| `client_name` | text | Client or company on the listing |
| `mission_type` | text | Client or mission type used by the dashboard filter |
| `address` | text | |
| `latitude`, `longitude` | numeric(9,6) | |
| `payout` | numeric(12,2) | USD |
| `travel_distance` | numeric(12,2) | Miles from home |
| `travel_time` | numeric(12,2) | Minutes from home |
| `due_window_start`, `due_window_end`, `deadline` | timestamptz | |
| `estimated_on_site_minutes` | numeric(12,2) | Minutes |
| `required_equipment` | jsonb | Array of strings or objects. Default `[]`. |
| `required_certifications` | jsonb | Array. Part 107, thermal, and similar. Default `[]`. |
| `deliverables` | jsonb | Array. Default `[]`. |
| `flight_plan` | jsonb | Array of steps. Default `[]`. See below. |
| `raw_email_html` | text | Original email HTML |
| `raw_email_text` | text | Original email text |
| `raw_detail` | jsonb | Full scraped mission page |
| `booking_id` | uuid | FK to `bookings.id`, `ON DELETE SET NULL`. Set when accepted. |
| `admin_notes` | text | Admin only. Default `''`, max 2000. Bot must not overwrite. |
| `tags` | jsonb | Admin only. Array of strings (`have skills`, `need equipment X`). Bot must not overwrite. |
| `cancel_status` | text | Admin only. Null, `cancel_requested`, `reschedule_requested`, or `cancelled`. Bot must not send it. |
| `cancel_reason` | text | Admin only. Reason in the pilot email. Bot must not send it. |
| `cancel_requested_at` | timestamptz | Admin only. When the cancel or reschedule draft was marked requested. |
| `cancelled_at` | timestamptz | Admin only. When Zeitview confirmed the cancel. |
| `bot_accepted_at` | timestamptz | Set by the bot at the moment it accepts. Null on the completed-mission backfill. Later upserts must omit it. |
| `equipment_search` | text | Generated from equipment and certifications. Do not write it. |
| `created_at`, `updated_at` | timestamptz | |

Cancel gig uses the same helper as the job-card status badge. An unlinked accepted listing is a completed job, so the badge says Completed and Cancel gig stays hidden. The button is shown only when the bot recorded the acceptance (`bot_accepted_at`, the linked booking's `accepted_at`, or an accept result in `raw_detail`) and the gig is still pending: the badge is not Completed, the booking is not completed, it is not a completed-mission backfill (`raw_detail` source, origin, or URL containing `completed`), a real flight time is not more than 12 hours past, and it is not cancelled. `status = accepted` alone is not enough. When the marker is missing, Cancel gig stays hidden. On accept, set `bookings.accepted_at` and `mission_listings.bot_accepted_at` to that same time. Do not set `bot_accepted_at` from `backfill-completed.js`.

`flight_plan` steps use these keys:

```json
{
  "name": "Roof overview",
  "instructions": "Orbit the structure once",
  "shot_type": "orbit",
  "altitude": 120,
  "angle": 45,
  "count": 1,
  "required": true
}
```

`shot_type` is `photo`, `video`, `orbit`, `panorama`, or `grid/mapping` when the listing says so. Omit altitude, angle, or count when the listing does not give them. `required` is a boolean.

Service role has full write access. Authenticated dashboard admins can `SELECT` and `UPDATE` (notes and tags). Anon has no grant and no policy, so the public key cannot read listings or raw email.

### `public.bot_settings` (acceptance rules the bot reads)

One row, `id = 1`. Read it with the service role. Do not insert another row. The dashboard is what updates it (`PUT /api/admin/bot-settings`). Null on `max_drive_minutes`, `daily_accept_cap`, or `min_notice_hours` means that limit is off.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | smallint | Primary key, default `1`, check `id = 1` |
| `auto_accept_enabled` | boolean | Default `true`. When false, record the mission and do not accept it. |
| `min_payout_usd` | numeric | Default `50`. Turn down a lower payout. |
| `long_trip_minutes` | int | Default `60`. A drive this long, or longer, is a long trip. |
| `long_trip_min_payout_usd` | numeric | Default `100`. Minimum payout for a long trip. |
| `max_drive_minutes` | int | Null means no maximum. A longer drive is not accepted. |
| `home_address` | text | Default `11205 Keystone Avenue, Clinton, MD`. Where drive time is measured from. |
| `home_lat` | double precision | Default `38.737679` |
| `home_lng` | double precision | Default `-76.894043` |
| `daily_accept_cap` | int | Null means no cap. Most accepts on one Eastern calendar day. |
| `min_notice_hours` | int | Null means notice is not checked. Hours the mission must be seen before the flight. |
| `travel_radius_miles` | numeric | Shared travel radius in miles. Null leaves the distance already set on each site. 1 to 500. The live row's Zeitview radius is 100, and the migration copies that into this column. Droners uses the number as Max distance in miles. Zeitview's profile only accepts 10, 25, 50, 100, or 200, so a trigger snaps a copy into the compatibility column below. |
| `zeitview_radius_miles` | numeric | Deprecated compatibility column. The live drone-gigs bot still reads it. Do not treat it as a shared field. A trigger fills it from `travel_radius_miles`. |
| `updated_at` | timestamptz | Set on update. |
| `updated_by` | text | Email of the admin who last saved the row. |

Zeitview sync status (`zeitview_last_synced_at`, `zeitview_last_result`, `zeitview_last_error`, `zeitview_observed`) is site state, not a shared rule. The live bot still writes those columns. A trigger copies them onto the Zeitview row in `gig_sources`. The dashboard reads `gig_sources`.

Apply `supabase/migrations/20261024200000_shared_bot_rules.sql` after `20261024010000_gig_sources.sql`. Do not apply it to production until you mean to. Deploy order:

1. Apply `20261024010000_gig_sources.sql` if it is not applied yet.
2. Apply `20261024200000_shared_bot_rules.sql`. This copies the current radius into `travel_radius_miles` and keeps `zeitview_radius_miles` in sync for the bot.
3. Deploy this dashboard. It reads and writes `travel_radius_miles` only.
4. Leave the drone-gigs bot as it is. It keeps reading `zeitview_radius_miles`.
5. Update the bot (see below), then drop the compatibility columns in a later migration. This change does not drop them.

`lawmbass/drone-gigs` was not changed here. The repo was not available from this workspace. The bot still has to:

- Read `travel_radius_miles`, `home_address`, `home_lat`, and `home_lng` as the shared profile settings. Until that change ships, keep reading `zeitview_radius_miles`. The trigger keeps that column equal to the snapped shared radius, so a dashboard save of 100 still shows up there as 100.
- Read the other shared columns (`auto_accept_enabled`, `min_payout_usd`, `long_trip_minutes`, `long_trip_min_payout_usd`, `max_drive_minutes`, `daily_accept_cap`, `min_notice_hours`) and apply them to every enabled source. Those rules are not pushed to the websites.
- When `gig_sources.profile_sync_requested_at` is newer than `profile_sync_at` and `enabled` is true, sync that source, then write `profile_sync_at`, `profile_sync_result` (`ok`, `failed`, or `nothing`), `profile_sync_error`, and `profile_sync_observed`. Do not change `enabled`, `updated_by`, or `profile_sync_requested_at`.
- Zeitview: keep the existing profile sync. Set the address from `home_address` and the radius from `travel_radius_miles` snapped to 10, 25, 50, 100, or 200. Writing the old `zeitview_last_*` columns still works; the trigger mirrors them. Prefer writing the Zeitview `gig_sources` row directly once the bot is updated.
- Droners.io: set Account Settings, Notifications, "Max distance in miles" to `travel_radius_miles` with no snap, and Account Settings, Locations, the primary location from `home_address`. Do not bid on or accept jobs.
- FlyGuys (`pilots.flyguys.com`): if the pilot profile has an address or a travel radius, set those from the shared home address and `travel_radius_miles`. If it has neither, set `profile_sync_result` to `nothing`. Mission alerts arrive by SMS. Do not accept missions.
- A missing `zeitview` row still means enabled. A missing `flyguys` or `droners` row means disabled. The seed inserts FlyGuys and Droners with `enabled` false. Do not ingest or insert bookings for a disabled source.
- Bookings may use `source` `flyguys` or `droners`. Zeitview mission ids stay `DBM` plus digits. FlyGuys and Droners ids are their own, 1 to 80 characters.

The seeded `max_drive_minutes` is null, so there is no maximum drive time until an admin sets one. `long_trip_minutes` defaults to 60. This repo does not read the live database. Lawrence reports the saved Zeitview radius is 100 miles. The migration copies that value into `travel_radius_miles` and the compatibility column stays 100 because 100 is already one of Zeitview's allowed radii.

Each bot rule is a label and its value until you press Edit rules. That opens every field. Save changes stores them in one request. Cancel restores the saved values. The last-30-days preview loads with the page and refreshes from the draft while you edit. Drive times for an unsaved address are measured only after an address is picked. Below 640px each preview mission is a stacked card (id and address, payout and drive, then an Accept, Decline, or Can't tell badge with the reason chips at full width). The table stays on wider screens.

The dashboard preview counts missions whose `first_seen_at` is in the last 30 days. It uses stored `payout` and, when the home pin is unchanged, stored `travel_time` (minutes). A missing drive time is "can't tell" once the payout is high enough. Minimum notice is applied only when the stored page has a real flight time. The counts still stop at the first failing rule, the same way the bot does. The Decision column lists every rule that row fails, including a missing drive time next to a decline.

When Edit is open on the home address and the pin is different from the saved one, the preview measures drive minutes on the server with the Routes API, the same check as `POST /api/admin/bot-settings/drive-times`. A mission latitude and longitude of null or `0,0` is ignored and the listing address is used instead. Results are cached in memory and capped at 30 Routes calls, newest missions first. Those minutes are not written. The bot recomputes stored `travel_time` after the address is saved. Until the stored minutes match the new pin, the page says drive times are updating.

The home address box searches through the server (`/api/admin/places/autocomplete` and `/api/admin/places/details`). The browser never sees `GOOGLE_MAPS_API_KEY`. Suggestions use Places API (New) autocomplete with a session token, and the chosen place uses Place Details (New) with that same token. A small map image is loaded through `/api/admin/places/map`. Saving a typed address that was not chosen still tries the Geocoding API; if that also fails, the save is rejected. Enable **Places API (New)**, **Geocoding API**, **Maps Static API**, and **Routes API** on the key.

Apply `supabase/migrations/20261013180000_bot_settings.sql` before deploying the page. The service role bypasses RLS. Authenticated dashboard admins (`is_dashboard_admin()`) can `SELECT` and `UPDATE`. Anon has no grant and no policy.

### `public.gig_sources` (connected gig feeds)

One row per source. Bot rules lists them under Connected sources: Zeitview, FlyGuys, and Droners.io. The page is data-driven: catalog entries in `libs/gigSources.js` plus any extra rows in this table. Apply `supabase/migrations/20261024010000_gig_sources.sql` and then `supabase/migrations/20261024200000_shared_bot_rules.sql` before the Enabled switch and profile sync can be saved. Do not apply either to production until you mean to. Until `gig_sources` exists, the dashboard shows Zeitview as enabled, FlyGuys and Droners as off, and the switch returns 503.

| Column | Who writes it | Notes |
| --- | --- | --- |
| `source_key` | migration | `zeitview`, `flyguys`, or `droners`. |
| `display_name` | migration, dashboard on insert | Zeitview, FlyGuys, or Droners.io. |
| `enabled` | dashboard (`PATCH /api/admin/gig-sources`) | Zeitview defaults to true. FlyGuys and Droners.io are seeded false. `false` tells the bot not to pull that source, not to add its bookings, and not to sync its profile. |
| `profile_sync_requested_at` | dashboard, on save of bot rules and when a source is enabled | Set only on enabled rows. The bot treats a request newer than `profile_sync_at` as work to do. |
| `profile_sync_at` | drone-gigs bot | When it last tried to sync this source. |
| `profile_sync_result` | drone-gigs bot | `ok`, `failed`, or `nothing`. |
| `profile_sync_error` | drone-gigs bot | Short error when the result is `failed`. |
| `profile_sync_observed` | drone-gigs bot | Address and distance last read back from the site. |
| `last_health` | drone-gigs bot | `ok`, `degraded`, or `down`. Fallback when `/health` cannot be reached. |
| `last_success_at` | drone-gigs bot | Last clean pull that also filled bookings. |
| `last_error` | drone-gigs bot | Short error. Null after a clean cycle. |
| `updated_at` | trigger | Set on update. |
| `updated_by` | dashboard | Admin email. The bot must leave this alone. |

The dot is green, orange, red, or gray. Gray wins whenever `enabled` is false, including when the last health was bad. The other colors for Zeitview are derived from `GET https://drone-gigs.onrender.com/health` (`DRONE_GIGS_HEALTH_URL` overrides it). A 15 second server cache avoids hammering that host. The raw health document is not sent to the browser. It includes home addresses.

Green means `status` is `ok`, Gmail poll is enabled, the last poll result is `ok`, `lastPollAt` is newer than 1.5 poll intervals (at least 6 minutes), `lastWatchError` is empty, the watch has not expired and is not inside 24 hours, `acceptFailures` and `unclearAccepts` are empty, profile sync is not failed and has no drift, recent mission outcomes have no failure, and drive-time backfill has no `error` and `failed` of 0. An unlocated backfill row does not change the dot.

Orange means the pipeline is up but one of those soft checks failed: poll missing or late, profile drift, an unclear accept, a failed recent outcome, a drive-time fill failure, or the watch expiring within a day. Red means the health status is not ok, the watch errored or expired, the poll is off, failed, or stale (older than 3 intervals, at least 15 minutes), an accept failed, or Zeitview profile sync failed. If `/health` cannot be reached, the row's `last_health` and `last_error` are shown. With nothing stored, the dot is orange and the text says the health check could not be reached. Sources other than Zeitview use stored `last_health` only.

Same admin check as the rest of Bot rules (`requireAdmin`: signed-in dashboard admin). Service role bypasses RLS. Authenticated admins (`is_dashboard_admin()`) can `SELECT` and `UPDATE`. Anon has no grant and no policy.

The drone-gigs bot has to honor the switch. This repo only stores it.

Read, with the service role, before each Zeitview poll and before creating a booking:

```sql
SELECT enabled FROM public.gig_sources WHERE source_key = 'zeitview';
```

A missing Zeitview row means enabled. A missing FlyGuys or Droners row means disabled. `enabled = false` means skip that source's ingest and do not insert its bookings. Leave bookings that already exist. Read `flyguys` and `droners` the same way, and do not treat a missing row for those two as enabled.

Profile sync runs only for enabled sources. The dashboard sets `profile_sync_requested_at` when bot rules are saved. The bot pushes the shared home address and travel radius, then writes the `profile_sync_*` result columns. `nothing` means the site has no matching address or radius setting (the FlyGuys case when its profile has neither). A failed result is the red flag on that source's card. Do not accept missions while syncing.

Write only the health columns, after a cycle. Do not change `enabled` or `updated_by`, and do not insert a second Zeitview row:

```sql
UPDATE public.gig_sources
SET last_health = 'ok',
    last_success_at = now(),
    last_error = NULL
WHERE source_key = 'zeitview';
```

Use `degraded` or `down` and a short `last_error` when the cycle was not clean, and leave `last_success_at` at the previous success. `ok` is a clean pull that filled bookings, `degraded` means it ran but something needs a fix, `down` means the pull, watch, profile sync, or an accept failed. The dashboard still prefers the live `/health` document for Zeitview when that request succeeds.

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run check:rls
npm run check:sources
node scripts/test-admin-login.js
```

## Layout

```
├── components/     # Public site, dashboard, listings
├── pages/api/      # Next.js API routes (service role after session checks)
├── libs/db/        # Supabase query helpers
├── supabase/migrations/
└── scripts/check-rls.js
```

## Stack

- Next.js 14, React 18, Tailwind
- Supabase Postgres (`@supabase/supabase-js`)
- NextAuth JWT (Google and credentials)
