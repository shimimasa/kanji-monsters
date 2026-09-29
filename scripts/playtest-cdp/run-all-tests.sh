#!/usr/bin/env bash
# Runs every test directory and compares the failing test names with baseline-failures.txt.
# Only the byte-freeze / allowlist gates are expected to fail; anything else is a regression.
# usage: bash scripts/playtest-cdp/run-all-tests.sh   (from the repo root)
here="$(cd "$(dirname "$0")" && pwd)"; out="$(mktemp)"
for d in tests/*/; do
  d=${d%/}; name=$(basename "$d")
  res=$(timeout 600 node --experimental-default-type=module --test "$d"/*.test.mjs 2>&1)
  echo "$name pass=$(echo "$res" | grep -E '^# pass' | awk '{print $3}') fail=$(echo "$res" | grep -E '^# fail' | awk '{print $3}')"
  echo "$res" | grep -E '^not ok' | sed "s/^not ok [0-9]* - /[$name] /" >> "$out"
done
# The baseline may have CRLF line endings on a Windows checkout.
if diff <(tr -d '\r' < "$here/baseline-failures.txt") "$out"; then
  echo "SAME-FAILS: only the known freeze gates fail"
else
  echo "DIFFERENT from baseline (see diff above)"
fi
rm -f "$out"
