#!/usr/bin/env bash
# Serves public/ with the Worker config (wrangler.jsonc) locally and checks
# what users get: the docs page at /, its files under /assets/, and the
# registry under /r/ exactly as before (JSON, CORS, short cache).
#
#   scripts/check-worker.sh   (after npm run registry and scripts/build-site.sh)
set -uo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo"
port=${WORKER_PORT:-8799}
log=$(mktemp)
npx wrangler dev --port "$port" --ip 127.0.0.1 >"$log" 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null; pkill -P $pid 2>/dev/null' EXIT
base="http://127.0.0.1:$port"
for _ in $(seq 120); do curl -sf -o /dev/null "$base/r/registry.json" && break; sleep 0.5; done

failed=0
check() { if eval "$2"; then echo "PASS worker: $1"; else echo "FAIL worker: $1"; failed=1; fi; }
header() { curl -sI "$base$1" | tr -d '\r' | grep -i "^$2:" | head -1 | cut -d' ' -f2-; }
status() { curl -s -o /dev/null -w '%{http_code}' "$base$1"; }

asset=$(grep -o '/assets/[^"]*\.js' public/index.html | head -1)
check "/ is the docs page (200, text/html)" '[ "$(status /)" = 200 ] && [[ "$(header / content-type)" == text/html* ]] && curl -s "$base/" | grep -q "<title>kumo-shadcn</title>"'
check "$asset is served with an immutable cache" '[ "$(status "$asset")" = 200 ] && [[ "$(header "$asset" cache-control)" == *immutable* ]]'
check "/r/registry.json is JSON with CORS" '[ "$(status /r/registry.json)" = 200 ] && [[ "$(header /r/registry.json content-type)" == application/json* ]] && [ "$(header /r/registry.json access-control-allow-origin)" = "*" ]'
check "/r/button.json matches public/r/button.json" 'curl -s "$base/r/button.json" | cmp -s - public/r/button.json'
check "/r/* keeps its 5-minute cache" '[[ "$(header /r/button.json cache-control)" == *max-age=300* ]]'
check "/_headers is not served" '[ "$(status /_headers)" = 404 ]'
check "a missing item is a 404" '[ "$(status /r/no-such-item.json)" = 404 ]'
[ $failed = 0 ] || { echo "wrangler log:"; tail -20 "$log"; }
exit $failed
