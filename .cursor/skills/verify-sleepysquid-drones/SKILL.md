---
name: verify-sleepysquid-drones
description: Drive the SleepySquid Drones Next.js 14 site (public marketing pages, login, and the admin dashboard) on a local dev server and prove a change with the shipped doctor and pricing harness. Use when verifying this app, checking the public site or dashboard, or proving a local instance before review.
---

# Verify SleepySquid Drones

Primary surface: the Next.js pages-router site (`npm run dev`). A visitor uses `/` (pricing, booking, contact). An admin uses `/login` then `/dashboard` sections. Other surfaces are the `/api/*` routes (bookings, contact, admin JSON, Stripe invoice webhooks, the invoice overdue cron) and the `scripts/check-*.mjs` plus `scripts/pg` fixtures. There is no worker in this repo. The gig bot lives in `lawmbass/drone-gigs` and is not started here.

Production is `https://drones.sleepysquid.com` and Supabase project `etbesmtdsjlmadaexvrv`. This skill never opens that site, never calls that project, never signs in as a real account, and never sends email, SMS, or a cancellation.

One `next dev` per checkout. It writes `.next`, so a second server in the same tree will collide. A second checkout can run beside it on another `VERIFY_PORT`.

## Launch

From the repo root, after `npm ci`:

```bash
.cursor/skills/verify-sleepysquid-drones/scripts/launch.sh
```

The script refuses to start if any dotenv file other than `.env.example` is in the repo root (Next would load it). It starts `npm run dev -- --port 3456 --hostname 127.0.0.1` in a clean environment:

- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9` (nothing listens; a database call is connection-refused on this machine)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=local-verify-anon`
- `SUPABASE_SERVICE_ROLE_KEY=local-verify-service`
- `NEXTAUTH_URL=http://127.0.0.1:3456`
- `NEXTAUTH_SECRET=local-verify-nextauth-secret`
- `ADMIN_EMAILS=verify-admin@example.test`
- `SITE_URL` is that same local origin

`RESEND_API_KEY`, `MAILGUN_API_KEY`, Stripe keys, `SMTP_*`, `GOOGLE_MAPS_API_KEY`, and reCAPTCHA keys are unset. Override the port with `VERIFY_PORT`. A non-default database URL is allowed only as `VERIFY_SUPABASE_URL=http://127.0.0.1:<port>` or `http://localhost:<port>`, and the host must not contain `etbesmtdsjlmadaexvrv` or `supabase.co`.

There is no app data directory and launch does not migrate or seed. An empty instance is usable when the homepage renders and the database is not connected: `GET /api/promo/active` fails closed (the promo banner stays off) and `GET /api/health/database` returns 503 with `database: "disconnected"`. The `projectRef` field in that JSON is the hardcoded constant `etbesmtdsjlmadaexvrv` even when nothing is connected. Do not read it as a live project.

State files (pid, log, env, evidence) live in `/tmp/verify-sleepysquid-drones`, outside the repo. Ready looks like `ready http://127.0.0.1:3456 pid <pid>`.

Teardown is `cleanup.sh` in Helpers. It does not delete evidence.

## Doctor

```bash
node .cursor/skills/verify-sleepysquid-drones/scripts/doctor.mjs
```

One read-only pass. It reads `/proc/<pid>/environ` for the process launch recorded and fails unless the URL is loopback, the keys are the placeholders above, `ADMIN_EMAILS` is `verify-admin@example.test`, and the environment contains no `etbesmtdsjlmadaexvrv`, `supabase.co`, `sk_live_`, `rk_live_`, Resend, Mailgun, or Stripe key. It then checks:

- `GET /` is 200 and contains the hero, the four pricing names, and `#service` / `#package`
- `GET /api/health/database` is 503 and not `connected` or `healthy`
- `GET /api/promo/active` is not 200
- `GET /dashboard` redirects to `/login`
- `GET /api/admin/bookings` and `GET /api/admin/listings` are 401
- `GET /login` is 200. The first HTML is the session loading shell (`Loading...`). `#email` and `#password` render only after `useSession` resolves in the browser. The pricing harness checks that hydrated form and does not type in it. A redirect from `/dashboard` must stay on `127.0.0.1` or `localhost` and the path `/login` (Next may name the host `localhost` when you asked for `127.0.0.1`)
- `GET /preview/connected-sources?state=green&theme=light` is 200 and names Zeitview and FlyGuys (fixture only; `previewPageAllowed` is true when `NODE_ENV` is not production)
- `GET /preview/bot-rules` is 200
- `node scripts/check-rls.js` with an empty environment (static SQL only; the live probe inserts rows when Supabase env vars are set, so doctor never leaves them set)
- `node scripts/check-public-copy.mjs`

Exit 0 prints `doctor: pass` and writes `/tmp/verify-sleepysquid-drones/evidence/doctor.json`.

## Drive

Drive the public pricing path with the harness. It is the journey a visitor can finish on the empty instance. Admin writes, contact send, booking submit, invites, invoice send, and cancel are mapped under `features/` and are not part of this run.

```bash
node .cursor/skills/verify-sleepysquid-drones/scripts/drive-pricing.mjs
```

The script uses system Chrome (`CHROME_PATH`, default `/usr/local/bin/google-chrome`) through `puppeteer-core`, installed on first run under `/tmp/verify-sleepysquid-drones/tools`. It waits for `domcontentloaded`. `networkidle` does not settle under `next dev` because the hot-reload socket stays open. It opens `http://127.0.0.1:3456/`, clicks the nav link `a[href="/#pricing"]`, and checks the `#pricing` cards: Listing Photos (`$199`), Listing Photos + Video (badge `Best for listings`), Event Aerials (`from $500`), Mapping & 3D (`$900`), plus `48-hour delivery` and `Travel fees may apply`. It clicks the `Book This Package` button in the card whose `h3` text is exactly `Listing Photos`.

Resulting state, still on step 1 of `#booking`:

- `#service` is `real-estate` (Real Estate Tours)
- `#package` is `listing-photos`
- the `Next Step` button is disabled, because step 1 also requires `#date`, `#location`, and a `placeId` from the address autocomplete, and `GOOGLE_MAPS_API_KEY` is unset so no place can be chosen
- the page does not show `Booking Submitted!`

Every request must be `GET` or `HEAD` to `127.0.0.1` or `localhost`, or an inline `data:` / `blob:` image (Next image blur placeholders and the date-field icon). The one allowed POST is next-auth's client logger, `POST /api/auth/_log` on that same host. It does not send mail or query Supabase. Any other POST, or any call to Supabase, Resend, Stripe, Google, or `drones.sleepysquid.com`, fails the run. `GET /api/promo/active` is expected and fails closed. Do not click `Next Step`, `Submit Booking`, or `Send Message`.

The same browser session then opens `/login`, waits until `#email` and `#password` exist, and checks both are empty and that a `Sign In` button is present. It does not type and does not submit. That is how you see the form the loading shell hides from curl.

Stable handles for the rest of the public form, when you extend this without submitting: `#date`, `#location`, `#details`, `#name`, `#email`, `#phone`, and the step-2 submit button whose label is `Submit Booking`. Contact is `#contact`, fields `name`, `email`, `subject`, `message` (placeholders `John Doe`, `john@example.com`, `How can we help you?`), submit `Send Message`. Login is `/login` with `#email`, `#password`, and a `Sign In` button. Do not sign in.

`POST /api/bookings` inserts a row and can send mail. `POST /api/contact` calls Resend (`libs/mailgun.js` posts to `https://api.resend.com/emails`). A missing `RESEND_API_KEY` only logs a warning in development; `sendEmail` still performs the HTTP call. There is no dry-run flag on those routes. reCAPTCHA does not make a submit safe.

`gig_sources.test_mode` is not a verification switch. The migration turns it on for FlyGuys and Droners and a FlyGuys test accept is a real accept. Leave it alone.

Invoice writes: `writesAllowed` in `libs/invoicing/core.mjs` returns true for any `sk_test_` / `rk_test_` key. A test key is not a skip. Live keys write when `INVOICING_LIVE_ENABLED=true`. Leave every Stripe variable unset so the mode is `none` and writes are refused. Do not POST `/api/admin/invoicing/invoices/:id/send` (body needs `confirmEmail` equal to the client and a fresh `confirmedAt`) or `.../resend` (body `confirm: "RESEND"`). Do not POST `/api/admin/clients/:id/invite` (`confirmEmail` sends one portal invite through Resend). Do not POST `/api/admin/listings/:id/cancel`.

`scripts/clients-merge-dry-run.mjs` defaults to `https://drones.sleepysquid.com` and signs in with `DRONES_CHECK_EMAIL`. Do not run it. `scripts/backfill-mission-type.mjs` reads `mission_listings` and `--apply` writes; do not run it. `npm run check:rls` probes and inserts when Supabase env vars are set; run it only the way doctor does, with those variables unset.

## Evidence

The harness writes under `/tmp/verify-sleepysquid-drones/evidence/`:

- `doctor.json` — instance checks and failures
- `health.json` — raw `/api/health/database` body
- `pricing-booking.png` — `#booking` after the package click
- `pricing-cards.png` — the `#pricing` card grid, taken after the mouse wheel brings Listing Photos into the viewport and the fade-in finishes. The text is asserted before the shot. `scrollIntoView` is not used for this shot: `html` has `scroll-behavior: smooth`, and a clip from an off-screen box photographs the hero
- `pricing-page.png` — the viewport after the form is filled
- `login.png` — hydrated login form, fields empty
- `drive.json` — selected service, package, `Next Step` disabled, blocked requests
- `requests.json` — every request the page made

Keep the server log at `/tmp/verify-sleepysquid-drones/next.log`. The proof is the action (package click) plus the form state plus the request log showing no write and no off-machine host.

Logic that must not touch a database is covered by the existing local scripts. From the repo root:

```bash
node scripts/check-public-copy.mjs
node scripts/check-admin-booking.mjs
node scripts/check-booking-address.mjs
node scripts/check-bot-rules.mjs
node scripts/check-gig-sources.mjs
node scripts/check-earnings.mjs
node scripts/check-client-hub.mjs
node scripts/check-user-deletion.mjs
npm test
```

`npm test` is `node --test scripts/tests/*.mjs`. Those files assert in memory. They do not connect to Supabase.

SQL fixtures in `scripts/pg/` drop and recreate tables. Run them only against a disposable local database you created, for example `PSQL="psql -h 127.0.0.1 -d scratch" scripts/pg/run-clients-merge.sh`. `run-delete-test-automation.sh` also needs `PORTAL_009` pointing at a local copy of that SQL file, not at the hosted project. Do not pass a Supabase connection string. The clients merge planner is already checked without Postgres by `node --test scripts/tests/clients-merge.test.mjs`, which uses the same rows as `scripts/pg/clients-merge.fixture.sql`.

## Cleanup

```bash
.cursor/skills/verify-sleepysquid-drones/scripts/cleanup.sh
```

This signals the pid recorded by `launch.sh` and, if that pid is a process-group leader, the group. It does not kill other Node processes and it does not remove `/tmp/verify-sleepysquid-drones/evidence` or `next.log`. Confirm the evidence files are still there after cleanup.

## Helpers

All three scripts live in `.cursor/skills/verify-sleepysquid-drones/scripts/` and are executable.

```bash
.cursor/skills/verify-sleepysquid-drones/scripts/launch.sh
node .cursor/skills/verify-sleepysquid-drones/scripts/doctor.mjs
node .cursor/skills/verify-sleepysquid-drones/scripts/drive-pricing.mjs
.cursor/skills/verify-sleepysquid-drones/scripts/cleanup.sh
```

`VERIFY_STATE` changes the state directory (default `/tmp/verify-sleepysquid-drones`). `VERIFY_PORT` changes the port (default `3456`). `CHROME_PATH` changes the browser. `VERIFY_SUPABASE_URL` is optional and must stay on loopback.

Feature map: [features/README.md](features/README.md).

When this skill drifts from the app, update it with `/maintain-verification-skill`.
