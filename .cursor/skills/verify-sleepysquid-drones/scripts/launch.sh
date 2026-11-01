#!/usr/bin/env bash
# Start one local Next.js dev server for SleepySquid Drones.
# The process environment never points at production Supabase, Stripe, or email.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
while [[ ! -f "$ROOT/package.json" ]]; do
  PARENT="$(dirname "$ROOT")"
  if [[ "$PARENT" == "$ROOT" ]]; then
    echo "launch: could not find package.json" >&2
    exit 1
  fi
  ROOT="$PARENT"
done

STATE="${VERIFY_STATE:-/tmp/verify-sleepysquid-drones}"
PORT="${VERIFY_PORT:-3456}"
mkdir -p "$STATE/evidence"
BASE="http://127.0.0.1:${PORT}"

if [[ -f "$STATE/pid" ]]; then
  OLD="$(cat "$STATE/pid")"
  if kill -0 "$OLD" 2>/dev/null; then
    echo "$BASE" > "$STATE/base-url"
    echo "already running pid $OLD at $BASE"
    exit 0
  fi
  rm -f "$STATE/pid"
fi

if command -v ss >/dev/null 2>&1 && ss -ltn | grep -q ":${PORT} "; then
  echo "launch: port ${PORT} is already in use. Set VERIFY_PORT to a free port." >&2
  exit 1
fi

if [[ ! -d "$ROOT/node_modules/next" ]]; then
  echo "launch: node_modules is missing. From $ROOT run: npm ci" >&2
  exit 1
fi

# Next loads .env* from disk even when the shell is clean. Refuse rather than
# risk those files pointing the server at the production project.
shopt -s nullglob
for f in "$ROOT"/.env "$ROOT"/.env.* "$ROOT"/.env.local "$ROOT"/.env.*.local; do
  [[ -f "$f" ]] || continue
  base="$(basename "$f")"
  if [[ "$base" == ".env.example" ]]; then
    continue
  fi
  echo "launch: refusing to start while $base is present. Move it out of $ROOT first. This skill does not read or copy it." >&2
  exit 1
done
shopt -u nullglob

# Closed port. Nothing listens, so a database call fails on this machine.
SUPABASE_URL="http://127.0.0.1:9"
if [[ -n "${VERIFY_SUPABASE_URL:-}" ]]; then
  SUPABASE_URL="$VERIFY_SUPABASE_URL"
fi
case "$SUPABASE_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *)
    echo "launch: VERIFY_SUPABASE_URL must be http://127.0.0.1 or http://localhost" >&2
    exit 1
    ;;
esac
if printf '%s' "$SUPABASE_URL" | grep -qi 'etbesmtdsjlmadaexvrv\|supabase\.co'; then
  echo "launch: refusing production Supabase URL" >&2
  exit 1
fi

cat > "$STATE/env" <<EOF
NODE_ENV=development
PORT=${PORT}
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-verify-anon
SUPABASE_SERVICE_ROLE_KEY=local-verify-service
NEXTAUTH_URL=${BASE}
NEXTAUTH_SECRET=local-verify-nextauth-secret
ADMIN_EMAILS=verify-admin@example.test
SITE_URL=${BASE}
EOF

# shellcheck disable=SC2046
setsid env -i \
  PATH="$PATH" \
  HOME="${HOME:-/tmp}" \
  NODE_ENV=development \
  PORT="$PORT" \
  NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=local-verify-anon \
  SUPABASE_SERVICE_ROLE_KEY=local-verify-service \
  NEXTAUTH_URL="$BASE" \
  NEXTAUTH_SECRET=local-verify-nextauth-secret \
  ADMIN_EMAILS=verify-admin@example.test \
  SITE_URL="$BASE" \
  npm run dev -- --port "$PORT" --hostname 127.0.0.1 \
  > "$STATE/next.log" 2>&1 < /dev/null &
echo $! > "$STATE/pid"
echo "$BASE" > "$STATE/base-url"

for _ in $(seq 1 90); do
  if curl -sf -o /dev/null "$BASE/"; then
    echo "ready $BASE pid $(cat "$STATE/pid")"
    exit 0
  fi
  if ! kill -0 "$(cat "$STATE/pid")" 2>/dev/null; then
    echo "launch: next exited. See $STATE/next.log" >&2
    tail -n 40 "$STATE/next.log" >&2 || true
    exit 1
  fi
  sleep 2
done

echo "launch: timed out waiting for $BASE/. See $STATE/next.log" >&2
exit 1
