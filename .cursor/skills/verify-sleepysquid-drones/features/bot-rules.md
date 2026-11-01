# Bot rules and connected sources

Shared acceptance rules and the Zeitview, FlyGuys, and Droners cards.

## Sub-features

- One shared rules form. Save is the button `Save changes` in the bar marked `data-edit-bar`. Cancel discards edits. The preview line says nothing is saved until Save changes.
- Connected sources are switches: `role="switch"` with `aria-label` `${name} enabled` or `${name} disabled` (Zeitview, FlyGuys, Droners.io). The track element is `[data-switch-track]`.
- Zeitview's dot is green, orange, red, or gray. Gray wins when the source is disabled. Other colors come from `GET https://drone-gigs.onrender.com/health` unless `DRONE_GIGS_HEALTH_URL` is set. The raw health document is not sent to the browser. It includes home addresses, so this skill does not fetch it.
- Droners stays a blue Manual status. FlyGuys and Droners can have `test_mode` rows. That flag is a one-shot real accept for FlyGuys, not a dry run. Zeitview never reads `test_rules`.

## How to get to it (user POV)

An admin opens `/dashboard?section=bot-rules` (sidebar: Drones, then Bot rules). `/admin/bot-rules` redirects there. Editing a rule shows `Unsaved changes.` Saving posts to `/api/admin/bot-settings` and can set `profile_sync_requested_at` on enabled sources. Turning a source on or off posts `/api/admin/gig-sources`.

## Driving it with the preview pages

The live section needs an admin session and the database. Do not save rules and do not toggle a source there.

The repo already has fixture pages that render the same components and do not call those APIs. They 404 when `NODE_ENV` is production and `VERCEL_ENV` is not `preview`. Launch sets `NODE_ENV=development`, and doctor requests both:

- `/preview/connected-sources?state=green&theme=light` (also `state=orange`, `red`, `disabled`, and `theme=dark`). The page says it is not the live admin list. Its toggle calls `applyEnabled` in React state only.
- `/preview/bot-rules` renders `BotRulesSection` with `fixture` settings and sample sources, including a Zeitview card that is on and a FlyGuys card that is off.

Local decisions (accept, decline, radius, profile sync copy) are `node scripts/check-bot-rules.mjs` and `node scripts/check-gig-sources.mjs`. Neither script calls the bot health URL.

A browser pass of the preview, if you add one, uses the switch `aria-label` values. Stop after the label flips. Do not go on to the dashboard save button.

## Gotchas

- Fetching `https://drone-gigs.onrender.com/health` from a drive is a call to the production bot and can include the home address in the payload the server sees. Leave `DRONE_GIGS_HEALTH_URL` unset and do not request that host.
- Saving bot rules on a live project asks the bot to sync the home address. Do not press `Save changes` against any database this skill did not create.
- `test_mode` on FlyGuys attempts one real accept when the bot's `FLYGUYS_PORTAL_ACCEPT` is on. Do not update `gig_sources`.
