#!/usr/bin/env bash
# Stop the Next process this skill started. Leaves /tmp/verify-sleepysquid-drones/evidence in place.
set -euo pipefail

STATE="${VERIFY_STATE:-/tmp/verify-sleepysquid-drones}"
if [[ ! -f "$STATE/pid" ]]; then
  echo "cleanup: no pid file at $STATE/pid"
  exit 0
fi

PID="$(cat "$STATE/pid")"
if [[ ! "$PID" =~ ^[0-9]+$ ]]; then
  echo "cleanup: pid file is not a number" >&2
  exit 1
fi

if kill -0 "$PID" 2>/dev/null; then
  # launch.sh starts the server with setsid, so the pid is the process group leader.
  kill -- "-$PID" 2>/dev/null || kill "$PID" 2>/dev/null || true
  for _ in $(seq 1 20); do
    if ! kill -0 "$PID" 2>/dev/null; then
      break
    fi
    sleep 0.25
  done
  if kill -0 "$PID" 2>/dev/null; then
    kill -9 -- "-$PID" 2>/dev/null || kill -9 "$PID" 2>/dev/null || true
  fi
  echo "cleanup: stopped pid $PID"
else
  echo "cleanup: pid $PID was not running"
fi

rm -f "$STATE/pid"
echo "cleanup: evidence kept in $STATE/evidence"
