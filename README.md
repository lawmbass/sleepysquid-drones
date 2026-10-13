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
- A non-admin who opens an admin section (`bookings`, `listings`, `promos`, `analytics`, `users`) is sent back to `/dashboard`.
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

- Bookings, mission analytics, promos, users
- **Listings**: every DroneBase/Zeitview mission the bot has seen, with filters, a detail view (requirements and flight-plan steps), and aggregates
- Overview stats, the recent jobs list, and analytics all read one job list: every booking, plus accepted `mission_listings` with no `booking_id`. Those listings count as completed Zeitview jobs. A listing that already has a booking is not counted again. The recent-jobs count is the length of that list. A listing's job date is the scraped flight date in `raw_detail` (schedule / parsed schedule / "flight date and time"), then `.mission-date` plus `.mission-time` in `raw_detail.html`, then an unlabeled `MM/DD/YYYY` and `HH:MMAM` in `raw_detail.text` (the pair just before "You must arrive on time"), then `due_window_start`, then `deadline`, then `due_window_end`. Page times with no zone are US Eastern. `last_seen_at` is used only when none of those exist. A listing with `cancel_status = cancelled`, and a booking linked to that listing, is left out of this list. Cancel-requested gigs stay in.

## drone-gigs

`lawmbass/drone-gigs` writes with the same `SUPABASE_SERVICE_ROLE_KEY` against this project. It no longer uses `MONGODB_URI`.

### `public.bookings` (accepted missions and customer bookings)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | `gen_random_uuid()` |
| `source` | text | `customer` (default), `zeitview`, or `manual` |
| `service` | text | Required, non-blank. Not limited to the website enum, so the bot is not blocked by it. |
| `package` | text | `basic`, `standard`, `premium`, or null |
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

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run check:rls
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
