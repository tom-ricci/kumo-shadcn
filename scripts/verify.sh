#!/usr/bin/env bash
# Installs every registry item with the real shadcn CLI into a fresh app and
# checks the result. One app per run:
#
#   scripts/verify.sh <vite|next> <iconLibrary> <kumo-theme|kumo-cloudflare|kumo-binding> [custom-aliases] [workdir]
#
# The app is made with `shadcn init` (Tailwind v4), items come from public/r
# served on localhost (scripts/serve-registry.ts), then: no IconPlaceholder
# left, no @cloudflare/kumo dependency, files where components.json says,
# tsc --noEmit, a production build, and Kumo's classes in the built CSS.
# Prints PASS/FAIL lines and exits non-zero on any failure.
set -uo pipefail

SHADCN="shadcn@4.23.0"
framework=$1 icons=$2 theme=$3 aliases=${4:-default}
repo=$(cd "$(dirname "$0")/.." && pwd)
work=${5:-$repo/.check/apps}
name="$framework-$icons-$theme${aliases/default/}"
name=${name//custom-aliases/-custom}
app="$work/$name"
port=$((4873 + RANDOM % 1000))
# Third-party packages install without running their install scripts.
export npm_config_ignore_scripts=true npm_config_audit=false npm_config_fund=false npm_config_update_notifier=false
export NEXT_TELEMETRY_DISABLED=1

failed=0
pass() { echo "PASS $name: $*"; }
fail() { echo "FAIL $name: $*"; failed=1; }
step() { # step <description> <command...>: run, log, PASS/FAIL
  local what=$1; shift
  if "$@" >"$work/$name.$(echo "$what" | tr -c 'a-z0-9' '-').log" 2>&1; then pass "$what"; else fail "$what (log: $work/$name.$(echo "$what" | tr -c 'a-z0-9' '-').log)"; tail -40 "$work/$name.$(echo "$what" | tr -c 'a-z0-9' '-').log"; return 1; fi
}

mkdir -p "$work" && rm -rf "$app"
node "$repo/scripts/serve-registry.ts" "$port" >"$work/$name.server.log" 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
for _ in $(seq 50); do curl -sf "http://127.0.0.1:$port/r/kumo-base.json" >/dev/null && break; sleep 0.1; done

# 1. Fresh app, the way the shadcn docs make one.
step "shadcn init -t $framework" bash -c "cd '$work' && npx -y $SHADCN init -t $framework -n '$name' -d -y" || exit 1
cd "$app" || exit 1

# 2. Icon library and (optionally) non-default aliases, before adding.
ui_alias="@/components/ui" lib_alias="@/lib"
if [ "$aliases" = custom-aliases ]; then ui_alias="@/components/kumo-ui" lib_alias="@/shared"; fi
node -e '
const fs = require("fs"); const c = JSON.parse(fs.readFileSync("components.json", "utf8"));
c.iconLibrary = process.argv[1]; c.aliases.ui = process.argv[2]; c.aliases.lib = process.argv[3];
fs.writeFileSync("components.json", JSON.stringify(c, null, 2));' "$icons" "$ui_alias" "$lib_alias"
src=.; [ -d src ] && src=src
dir() { echo "$src/${1#@/}"; }

# 3. Every item: helpers, icon shim, all components and blocks, one theme.
mapfile -t urls < <(node -e '
const r = require(process.argv[1]); const themes = ["kumo-theme", "kumo-cloudflare", "kumo-binding"];
for (const i of r.items) if (!themes.includes(i.name) || i.name === process.argv[2]) console.log(`http://127.0.0.1:${process.argv[3]}/r/${i.name}.json`);' "$repo/registry.json" "$theme" "$port")
step "shadcn add (${#urls[@]} items)" npx -y $SHADCN add "${urls[@]}" -y -o || exit 1

# 4. Where files landed, and what the CLI rewrote.
[ -f "$(dir "$ui_alias")/button/index.ts" ] && [ -f "$(dir "$lib_alias")/kumo/icons.tsx" ] && [ -f "$(dir @/components)/delete-resource/index.ts" ] \
  && pass "files are where components.json aliases say ($ui_alias, $lib_alias)" || fail "files not at the components.json aliases"
sources=$(find "$src" -path ./node_modules -prune -o -path "$src/node_modules" -prune -o \( -name '*.ts' -o -name '*.tsx' \) -print)
left=$(grep -lE '<IconPlaceholder|from "[^"]*icon-placeholder"' $sources)
if [ -n "$left" ]; then fail "IconPlaceholder left in: $(echo $left)"; else pass "no IconPlaceholder left"; fi
phosphor=$(grep -lE "from ['\"]@phosphor-icons/react" $sources)
if [ "$icons" != phosphor ] && [ -n "$phosphor" ]; then fail "@phosphor-icons/react still imported in: $(echo $phosphor)"; else pass "icons come from $icons"; fi
if grep -q '"@cloudflare/kumo"' package.json; then fail "@cloudflare/kumo in package.json"; else pass "no @cloudflare/kumo dependency"; fi
grep -q "Permission is hereby granted" "$(dir "$ui_alias")/button/button.tsx" && pass "license header kept" || fail "license header missing"

# 5. Demo page that imports every item, then type check and build.
node -e '
const r = require(process.argv[1]); const [ui, comps] = [process.argv[2], "@/components"];
const items = r.items.filter((i) => i.type === "registry:ui" || i.type === "registry:block");
const id = (n) => "kumo_" + n.replace(/-/g, "_");
console.log(items.map((i) => `import * as ${id(i.name)} from "${i.type === "registry:ui" ? ui : comps}/${i.name}/index";`).join("\n"));
console.log(`export const kumoModules = [${items.map((i) => id(i.name)).join(", ")}];`);' "$repo/registry.json" "$ui_alias" >"$src/kumo-all.ts"
sed -e "s#@/components/ui/#$ui_alias/#g" -e "s#@/lib/kumo/#$lib_alias/kumo/#g" "$repo/scripts/verify/kumo-demo.tsx" >"$src/kumo-demo.tsx"
if [ "$framework" = vite ]; then
  printf 'import { KumoDemo } from "./kumo-demo";\n\nexport default function App() {\n  return <KumoDemo />;\n}\n' >src/App.tsx
  step "tsc --noEmit" npx tsc -p tsconfig.app.json --noEmit
  step "vite build" npx vite build
  css=$(ls dist/assets/*.css 2>/dev/null)
else
  page=$( [ -d src/app ] && echo src/app/page.tsx || echo app/page.tsx )
  # A Server Component page that renders Kumo components directly and the
  # client demo, to cover the RSC boundary.
  printf 'import { Badge } from "%s/badge/index";\nimport { Button } from "%s/button/index";\nimport { KumoDemo } from "@/kumo-demo";\n\nexport default function Page() {\n  return (\n    <main>\n      <div className="flex gap-2 bg-kumo-base p-4">\n        <Badge variant="primary">Server</Badge>\n        <Button variant="secondary">Server button</Button>\n      </div>\n      <KumoDemo />\n    </main>\n  );\n}\n' "$ui_alias" "$ui_alias" >"$page"
  step "tsc --noEmit" npx tsc --noEmit
  step "next build" npx next build
  css=$(find .next/static -name '*.css' 2>/dev/null)
fi
if [ -n "$css" ] && grep -q "bg-kumo-base" $css && grep -q -- "--kumo-base:" $css && grep -q "@keyframes skeleton" $css; then
  pass "built CSS has Kumo utilities, $theme tokens and keyframes"
else fail "built CSS is missing Kumo utilities, tokens or keyframes"; fi

exit $failed
