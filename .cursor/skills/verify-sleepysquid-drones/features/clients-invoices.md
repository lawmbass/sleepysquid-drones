# Clients and invoices

The admin client hub and Stripe invoicing.

## Sub-features

- Clients (`/dashboard?section=clients`): `data-testid="new-client"` (`+ New client`), filter tabs `data-testid="filter-…"`, search `aria-label="Search clients"`, table `data-testid="clients-table"`, row `data-testid="client-row"`, form `data-testid="client-form"` with `#cf-business`, `#cf-contact`, `#cf-phone`, `#cf-email`. Service chips are `data-testid="svc-…"`. Invite is `data-testid="form-invite"` or `save-invite` (`Save and invite to portal`). Archive is `data-testid="form-archive"`.
- Invoices (`/dashboard?section=invoices`): `data-testid="invoices-new"` (`New invoice`), chips `data-testid="invoice-chips"`, search `data-testid="invoice-search"` (`aria-label="Search invoices"`), list `data-testid="invoice-list"`, row `data-testid="invoice-row"`. The composer is `data-testid="invoice-composer"`.
- Team is `/dashboard?section=team`. Old `section=users` redirects there for admins. Old `section=ai-admin` redirects to clients.

## How to get to it (user POV)

An admin uses the sidebar: Clients, or Invoices. New client opens the form. Saving without invite posts the client. `Save and invite to portal` also emails a portal invite. New invoice opens the composer. Send asks for the client's email as confirmation and then finalizes a Stripe invoice. Resend and Void are separate confirms. A client row can link to `section=invoices&client=<ref>` via `data-testid="row-new-invoice"`.

## Driving it with node tests and the browser

Default launch redirects these pages to `/login`. Doctor does not fetch them past that. Do not sign in, do not click Invite, Save and invite, Send, Resend, Void, or Delete.

In-memory coverage:

```bash
node --test scripts/tests/clients-merge.test.mjs
node --test scripts/tests/invoicing.test.mjs scripts/tests/invoice-delete.test.mjs scripts/tests/invoice-ux.test.mjs
node scripts/check-client-hub.mjs
```

`clients-merge.test.mjs` uses the same people and invoices as `scripts/pg/clients-merge.fixture.sql` (Verify Test `<verify@example.com>`, Bo at Acme Roofing, and so on). Those addresses are fixture rows, not accounts to email.

A disposable local Postgres, only if you created the database yourself:

```bash
PSQL="psql -h 127.0.0.1 -d scratch" scripts/pg/run-clients-merge.sh
```

The script drops tables. `psql` with no host is whatever your environment defaults to. Do not point `PSQL` at Supabase. `run-delete-test-automation.sh` needs `PORTAL_009` set to a local SQL file. Do not apply `supabase/portal_013_delete_test_automation.sql` or any file in `supabase/migrations` to project `etbesmtdsjlmadaexvrv`.

## Gotchas

- Invite sends one email when `confirmEmail` matches the client (`pages/api/admin/clients/[id]/invite.js`) and posts to Resend. There is no skip when the API key is missing.
- `writesAllowed` allows every `sk_test_` and `rk_test_` key. Test mode still creates Stripe invoices. Live keys also write when `INVOICING_LIVE_ENABLED=true`. Unset Stripe variables. The mode is then `none` and writes are refused.
- Send requires `confirmEmail` equal to the client email and `confirmedAt` within five minutes (`pages/api/admin/invoicing/invoices/[id]/send.js`). Resend requires body `confirm` equal to `RESEND`. Do not send those bodies.
- `scripts/clients-merge-dry-run.mjs` signs into `https://drones.sleepysquid.com` by default. Do not run it.
- `check-client-hub.mjs` asserts coupon validation locally and that a live Stripe key does not allow hub writes. It does not call Stripe when you run it as shipped.
