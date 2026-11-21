#!/usr/bin/env bash
# Builds the docs page (site/) with kumo-shadcn itself and puts it at the
# root of public/: public/index.html and public/assets/. The registry in
# public/r is never touched (checked at the end).
#
#   scripts/build-site.sh   (after npm run registry, so public/r is current)
#
# The page's Kumo components are installed with the real shadcn CLI from the
# registry that was just built: public/r is served on localhost (scripts/serve-registry.ts)
# and the site's "@kumo" namespace points at it. They are not checked in.
set -euo pipefail

SHADCN="shadcn@4.23.0"
repo=$(cd "$(dirname "$0")/.." && pwd)
work=${SITE_BUILD_DIR:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/kumo-shadcn-site}
export npm_config_ignore_scripts=true npm_config_audit=false npm_config_fund=false npm_config_update_notifier=false

[ -f "$repo/public/r/registry.json" ] || { echo "public/r is not built (run npm run registry)" >&2; exit 1; }
registry_sum() { (cd "$repo/public/r" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum); }
before=$(registry_sum)

rm -rf "$work" && mkdir -p "$work"
# Not site/.gitignore: it ignores the installed components, and Tailwind's
# source detection skips ignored files, so their classes would be missing.
(cd "$repo/site" && tar --exclude=.gitignore --exclude=node_modules --exclude=dist --exclude=src/components/ui --exclude=src/lib -cf - .) | tar -xf - -C "$work"
cd "$work"
npm ci

node "$repo/scripts/serve-registry.ts" 0 >server.log 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
port=
for _ in $(seq 100); do port=$(sed -n 's#^registry at http://127.0.0.1:\([0-9]*\)/r$#\1#p' server.log); [ -n "$port" ] && break; sleep 0.1; done
[ -n "$port" ] || { echo "registry server did not start" >&2; exit 1; }
node -e '
const fs = require("fs"); const c = JSON.parse(fs.readFileSync("components.json", "utf8"));
c.registries["@kumo"] = `http://127.0.0.1:${process.argv[1]}/r/{name}.json`;
fs.writeFileSync("components.json", JSON.stringify(c, null, 2));' "$port"

mapfile -t items < <(grep -v '^#' kumo-items.txt | sed '/^$/d; s/^/@kumo\//')
npx -y "$SHADCN" add "${items[@]}" -y
npx tsc --noEmit
npx vite build

# Replace the previous page, and only the page.
rm -rf "$repo/public/index.html" "$repo/public/assets"
cp dist/index.html "$repo/public/index.html"
cp -r dist/assets "$repo/public/assets"
after=$(registry_sum)
[ "$before" = "$after" ] || { echo "public/r changed while building the site" >&2; exit 1; }
echo "site built: public/index.html, public/assets/ ($(ls "$repo/public/assets" | wc -l) files); public/r unchanged"
