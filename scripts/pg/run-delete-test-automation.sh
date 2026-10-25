#!/usr/bin/env bash
# Real-Postgres test for supabase/portal_013_delete_test_automation.sql. Usage: PSQL="psql -d scratch" scripts/pg/run-delete-test-automation.sh
# Needs portal_009 (hard delete) SQL at $PORTAL_009 (lives in the sleepysquid-ai repo: supabase/drones/portal_009_client_hard_delete.sql).
set -euo pipefail
cd "$(dirname "$0")/../.."
PSQL=${PSQL:-psql}
$PSQL -q -v ON_ERROR_STOP=1 -f scripts/pg/delete-test-automation.test.sql
$PSQL -q -v ON_ERROR_STOP=1 -f "${PORTAL_009:?set PORTAL_009}" 2>&1 | grep -v NOTIFY || true
$PSQL -q -v ON_ERROR_STOP=1 -f supabase/portal_013_delete_test_automation.sql
$PSQL -q -v ON_ERROR_STOP=1 -1 -f scripts/pg/delete-test-automation.assert.sql
