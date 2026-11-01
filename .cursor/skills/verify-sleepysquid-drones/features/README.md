# SleepySquid Drones feature map

The primary surface is the website. These are the journeys a person actually takes. The safe local proof is the public pricing path (`drive-pricing.mjs` plus `scripts/check-public-copy.mjs`). The admin journeys are real and are not shortened; on the default launch they stop at the login wall because this skill does not create accounts or call production.

| Feature | Who | Where |
| --- | --- | --- |
| [Public pricing and booking](public-pricing.md) | Visitor | `/` `#pricing` then `#booking` |
| [Admin bookings](admin-bookings.md) | Admin | `/dashboard?section=bookings` |
| [Mission listings](mission-listings.md) | Admin | `/dashboard?section=listings` |
| [Bot rules and connected sources](bot-rules.md) | Admin | `/dashboard?section=bot-rules` |
| [Clients and invoices](clients-invoices.md) | Admin | `/dashboard?section=clients` and `section=invoices` |

Login for every dashboard section is `/login` (`#email`, `#password`, button `Sign In`). Unauthenticated `GET /dashboard` redirects to `/login`. Unauthenticated admin APIs return 401. Do not sign in with a real account.
