#!/usr/bin/env bash
# Real-Postgres test of the clients merge up + down path on a scratch DB. Usage: PSQL="psql -d scratch" scripts/pg/run-clients-merge.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
PSQL=${PSQL:-psql}
run() { $PSQL -q -X -v ON_ERROR_STOP=1 "$@"; }
run -f scripts/pg/clients-merge.fixture.sql
run -f supabase/migrations/20261027040000_clients_merge.sql
run -f scripts/pg/clients-merge.assert.sql
run -c "INSERT INTO public.invoices (client_id, total_cents) SELECT id, 4200 FROM public.clients WHERE portal_client_id = 'alpha'"  # created after the merge
run -f supabase/down/20261027040000_clients_merge.down.sql
run -f scripts/pg/clients-merge.down-assert.sql
run -f supabase/migrations/20261027040000_clients_merge.sql   # up again after down
run -c "SELECT count(*) AS clients FROM public.clients" -t
run -f supabase/migrations/20261027040000_clients_merge.sql   # rerun: no-op
run -f scripts/pg/clients-merge.assert.sql
# Partial apply (prod 2026-10-27) -> migration fixes forward, twice.
run -f scripts/pg/clients-merge.fixture.sql
run -f scripts/pg/clients-merge.partial.sql
run -f supabase/migrations/20261027040000_clients_merge.sql
run -f supabase/migrations/20261027040000_clients_merge.sql
run -f scripts/pg/clients-merge.assert.sql
run -x -f scripts/pg/clients-merge-state.sql > /dev/null
echo "clients-merge up/down/rerun/partial: OK"
