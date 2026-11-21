#!/usr/bin/env bash
# Installs every registry item with the real shadcn CLI into a fresh app and
# checks the result. One app per run:
#
#   scripts/verify.sh <vite|next> <iconLibrary> <kumo-theme|kumo-cloudflare|kumo-binding> [default|custom-aliases] [items|-] [transform]
#
# [items] is a comma-separated list (e.g. input) to add only those items and
# their dependencies, as a user would, instead of every item ("-": all).
# [transform] sets a components.json option that makes the shadcn CLI
# transform the files it writes: rtl (rtl: true), jsx (tsx: false),
# no-css-vars (tailwind.cssVariables: false), no-rsc (rsc: false), or prefix
# (tailwind.prefix "tw", which Kumo does not support: the run checks that it
# still doesn't). Apps go to $VERIFY_DIR (default: a temp directory outside
# the repository).
#
# The app is made with `shadcn init` (Tailwind v4), items come from public/r
# served on localhost (scripts/serve-registry.ts), then: no IconPlaceholder
# left, no @cloudflare/kumo dependency, files where components.json says,
# tsc --noEmit, a production build, and Kumo's classes in the built CSS.
# Prints PASS/FAIL lines and exits non-zero on any failure.
set -uo pipefail

SHADCN="shadcn@4.23.0"
framework=$1 icons=$2 theme=$3 aliases=${4:-default} only=${5:-} transform=${6:-none}
[ "$only" = - ] && only=""
repo=$(cd "$(dirname "$0")/.." && pwd)
# Outside the repository, so the apps can't resolve this repo's node_modules.
work=${VERIFY_DIR:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/kumo-shadcn-verify}
name="$framework-$icons-$theme${aliases/default/}"
name=${name//custom-aliases/-custom}
[ -n "$only" ] && name="$name-only-${only//,/-}"
[ "$transform" != none ] && name="$name-$transform"
case "$transform" in none|rtl|jsx|no-css-vars|no-rsc|prefix) ;; *) echo "unknown transform $transform"; exit 2 ;; esac
if [ "$transform" = no-css-vars ] && [ "$theme" = kumo-binding ]; then
  echo "FAIL $name: kumo-binding needs cssVariables: true (it reads your shadcn CSS variables)"; exit 1
fi
app="$work/$name"
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
node "$repo/scripts/serve-registry.ts" 0 >"$work/$name.server.log" 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
port=
for _ in $(seq 100); do port=$(sed -n 's#^registry at http://127.0.0.1:\([0-9]*\)/r$#\1#p' "$work/$name.server.log"); [ -n "$port" ] && break; sleep 0.1; done
[ -n "$port" ] || { echo "FAIL $name: registry server did not start"; exit 1; }

# 1. Fresh app, the way the shadcn docs make one.
step "shadcn init -t $framework" bash -c "cd '$work' && npx -y $SHADCN init -t $framework -n '$name' -d -y" || exit 1
cd "$app" || exit 1

# 2. Icon library and (optionally) non-default aliases, before adding.
ui_alias="@/components/ui" lib_alias="@/lib"
if [ "$aliases" = custom-aliases ]; then ui_alias="@/components/kumo-ui" lib_alias="@/shared"; fi
node -e '
const fs = require("fs"); const c = JSON.parse(fs.readFileSync("components.json", "utf8"));
c.iconLibrary = process.argv[1]; c.aliases.ui = process.argv[2]; c.aliases.lib = process.argv[3];
const t = process.argv[4];
if (t === "rtl") c.rtl = true;
if (t === "jsx") c.tsx = false;
if (t === "no-css-vars") c.tailwind.cssVariables = false;
if (t === "no-rsc") c.rsc = false;
if (t === "prefix") c.tailwind.prefix = "tw";
fs.writeFileSync("components.json", JSON.stringify(c, null, 2));' "$icons" "$ui_alias" "$lib_alias" "$transform"
if [ "$transform" = prefix ]; then
  # Tailwind v4 prefix: on the import, and on every class in the template's @apply lines.
  css_file=$(node -p 'require("./components.json").tailwind.css')
  sed -i -E 's#^@import "tailwindcss";#@import "tailwindcss" prefix(tw);#' "$css_file"
  sed -i -E '/@apply /{s/@apply //; s/([^ ;]+)/tw:\1/g; s/^(\s*)tw:/\1@apply tw:/}' "$css_file"
fi
# shadcn init installs the icon library's packages; do the same for the one
# picked here (the list is the CLI's own, from shadcn/icons).
mapfile -t icon_packages < <(node --input-type=module -e '
const { iconLibraries } = await import(process.cwd() + "/node_modules/shadcn/dist/icons/index.js");
console.log(iconLibraries[process.argv[1]].packages.join("\n"));' "$icons")
step "install ${icon_packages[*]}" npm install "${icon_packages[@]}" || exit 1
src=.; [ -d src ] && src=src
dir() { local d="$src/${1#@/}"; echo "${d#./}"; }

# 3. Every item (helpers, icon shim, all components and blocks) or just
# [items], plus one theme.
mapfile -t urls < <(node -e '
const r = require(process.argv[1]); const themes = ["kumo-theme", "kumo-cloudflare", "kumo-binding"];
const only = process.argv[4] ? process.argv[4].split(",") : null;
for (const i of r.items) if (i.name === process.argv[2] || (!themes.includes(i.name) && (!only || only.includes(i.name)))) console.log(`http://127.0.0.1:${process.argv[3]}/r/${i.name}.json`);' "$repo/registry.json" "$theme" "$port" "$only")
step "shadcn add (${#urls[@]} items)" npx -y $SHADCN add "${urls[@]}" -y -o || exit 1

# 4. Where files landed, and what the CLI rewrote.
ts=ts; [ "$transform" = jsx ] && ts=js # tsx: false writes .js/.jsx
probe=${only%%,*}; probe=${probe:-button}
probe_dir="$(dir "$ui_alias")/$probe" # a block lands under the components alias
[ "$(node -p 'require(process.argv[1]).type' "$repo/public/r/$probe.json")" = registry:block ] && probe_dir="$(dir @/components)/$probe"
[ -f "$probe_dir/index.$ts" ] && [ -f "$(dir "$lib_alias")/kumo/cn.$ts" ] && { [ -n "$only" ] || [ -f "$(dir @/components)/delete-resource/index.$ts" ]; } \
  && pass "files are where components.json aliases say ($ui_alias, $lib_alias)" || fail "files not at the components.json aliases"
sources=$(find "$src" -path ./node_modules -prune -o -path "$src/node_modules" -prune -o \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -print)
left=$(grep -lE '<IconPlaceholder|from "[^"]*icon-placeholder"' $sources)
if [ -n "$left" ]; then fail "IconPlaceholder left in: $(echo $left)"; else pass "no IconPlaceholder left"; fi
phosphor=$(grep -lE "from ['\"]@phosphor-icons/react" $sources)
if [ "$icons" != phosphor ] && [ -n "$phosphor" ]; then fail "@phosphor-icons/react still imported in: $(echo $phosphor)"; else pass "icons come from $icons"; fi
if grep -q '"@cloudflare/kumo"' package.json; then fail "@cloudflare/kumo in package.json"; else pass "no @cloudflare/kumo dependency"; fi
grep -q "Permission is hereby granted" "$probe_dir/index.$ts" && pass "license header kept" || fail "license header missing"

# 5. Demo page that imports every item, then type check and build.
node -e '
const r = require(process.argv[1]); const [ui, comps] = [process.argv[2], "@/components"];
const only = process.argv[3] ? process.argv[3].split(",") : null;
const items = r.items.filter((i) => (i.type === "registry:ui" || i.type === "registry:block") && (!only || only.includes(i.name)));
const id = (n) => "kumo_" + n.replace(/-/g, "_");
console.log(items.map((i) => `import * as ${id(i.name)} from "${i.type === "registry:ui" ? ui : comps}/${i.name}/index";`).join("\n"));
console.log(`export const kumoModules = [${items.map((i) => id(i.name)).join(", ")}];`);' "$repo/registry.json" "$ui_alias" "$only" >"$src/kumo-all.ts"
if [ -z "$only" ]; then
  sed -e "s#@/components/ui/#$ui_alias/#g" -e "s#@/lib/kumo/#$lib_alias/kumo/#g" "$repo/scripts/verify/kumo-demo.tsx" >"$src/kumo-demo.tsx"
else # only some items installed: a page that just imports them
  printf '"use client";\nimport { kumoModules } from "./kumo-all";\n\nexport function KumoDemo() {\n  return <div className="bg-kumo-base">{kumoModules.length}</div>;\n}\n' >"$src/kumo-demo.tsx"
fi
if [ "$framework" = vite ]; then
  printf 'import { KumoDemo } from "./kumo-demo";\n\nexport default function App() {\n  return <KumoDemo />;\n}\n' >src/App.tsx
  tsc_cmd=(npx tsc -p tsconfig.app.json --noEmit) build_cmd=(npx vite build) tsconfig=tsconfig.app.json
else
  page=$( [ -d src/app ] && echo src/app/page.tsx || echo app/page.tsx )
  # Stock phase: a Server Component page that renders Kumo components
  # directly. Kumo's source has "use client" only where Kumo's own source
  # does (its npm build adds it everywhere), so this must fail, as documented.
  printf 'import { Badge } from "%s/badge/index";\nimport { Button } from "%s/button/index";\nimport { KumoDemo } from "@/kumo-demo";\n\nexport default function Page() {\n  return (\n    <main>\n      <div className="flex gap-2 bg-kumo-base p-4">\n        <Badge variant="primary">Server</Badge>\n        <Button variant="secondary">Server button</Button>\n      </div>\n      <KumoDemo />\n    </main>\n  );\n}\n' "$ui_alias" "$ui_alias" >"$page"
  tsc_cmd=(npx tsc --noEmit) build_cmd=(npx next build) tsconfig=tsconfig.json
fi

# 5a. The template exactly as `shadcn init` made it. Kumo's code is copied
# as-is, so stricter template settings report errors, as they would for any
# shadcn component. The exact set (file and error code, alias folders written
# as <ui>/<lib>/<components>) must match scripts/verify/expected-errors-<framework>.txt,
# so any change shows up. VERIFY_RECORD=1 rewrites that file instead.
expected="$repo/scripts/verify/expected-errors-$framework.txt"
normalize() {
  sed -E 's/\x1b\[[0-9;]*m//g' | sed -nE \
    -e 's#^([^ (]+)\([0-9]+,[0-9]+\): error (TS[0-9]+):.*#\1 \2#p' \
    -e 's#^\[([A-Z_]+)\] (.*)$#build \1 \2#p' \
    -e 's#^Error: You.re importing a module that depends on `([^`]+)` into a React Server Component module.*#build server-component imports \1#p' |
    sed -E -e "s#(^|\")$(dir "$ui_alias")/#\1<ui>/#g" -e "s#(^|\")$(dir "$lib_alias")/#\1<lib>/#g" -e "s#(^|\")$(dir @/components)/#\1<components>/#g"
}
if [ -z "$only" ] && [ "$transform" = none ]; then
  { "${tsc_cmd[@]}" 2>&1 | normalize
    if "${build_cmd[@]}" >"$work/$name.stock-build.log" 2>&1; then echo "build: ok"; else echo "build: failed"; fi
    normalize <"$work/$name.stock-build.log"
  } | LC_ALL=C sort >"$work/$name.stock-errors.txt"
  if [ -n "${VERIFY_RECORD:-}" ]; then
    { echo "# Errors a stock \`shadcn init -t $framework\` app reports after adding every item (scripts/verify.sh)."
      echo "# One line per error: file and code, or the build result and bundler errors."
      cat "$work/$name.stock-errors.txt"; } >"$expected"
    pass "stock template: recorded $(grep -c . "$work/$name.stock-errors.txt") lines to $(basename "$expected")"
  elif diff <(grep -v '^#' "$expected" | LC_ALL=C sort) "$work/$name.stock-errors.txt" >"$work/$name.stock-diff.txt"; then
    pass "stock template: tsc and build report exactly the expected errors ($(grep -c ' TS' "$work/$name.stock-errors.txt") tsc errors, $(grep '^build:' "$work/$name.stock-errors.txt"))"
  else
    fail "stock template: errors differ from $(basename "$expected") (< expected, > now):"; cat "$work/$name.stock-diff.txt"
  fi
fi

# 5b. The same app with the settings the README tells users to relax.
# Then tsc must be clean and the production build must pass.
relax=()
[ "$framework" = vite ] && relax=(erasableSyntaxOnly noUnusedParameters verbatimModuleSyntax)
for flag in "${relax[@]}"; do sed -i -E "s/\"$flag\": true/\"$flag\": false/" "$tsconfig"; done
# Next.js: Kumo components used from a "use client" file (the demo), as the README says.
[ "$framework" = next ] && printf 'import { KumoDemo } from "@/kumo-demo";\n\nexport default function Page() {\n  return <KumoDemo />;\n}\n' >"$page"
# With tsx: false the components are JavaScript, so there is nothing to type-check.
[ "$transform" != jsx ] && step "tsc --noEmit${relax:+ (relaxed: ${relax[*]})}" "${tsc_cmd[@]}"
step "${build_cmd[*]:1}" "${build_cmd[@]}"
if [ "$framework" = vite ]; then css=$(ls dist/assets/*.css 2>/dev/null); else css=$(find .next/static -name '*.css' 2>/dev/null); fi
if [ -n "$css" ] && grep -q "bg-kumo-base" $css && grep -q -- "--kumo-base:" $css && grep -q "@keyframes skeleton" $css; then
  pass "built CSS has Kumo utilities, $theme tokens and keyframes"
else fail "built CSS is missing Kumo utilities, tokens or keyframes"; fi

# 6. Hover/selected backgrounds in a real browser (needs $CHROMIUM), for the
# themes whose values are known: Kumo's tint, or kumo-cloudflare's highlight.
if [ "$framework" = vite ] && [ -z "$only" ] && [ "$theme" != kumo-binding ] && [ -n "${CHROMIUM:-}" ]; then
  if node "$repo/scripts/check-highlight.ts" "$work/$name-shots" "$app/dist=$theme" >"$work/$name.highlight.log" 2>&1; then ok=1; else ok=0; fi
  if [ "$transform" = prefix ]; then
    # The CLI prefixes className strings but not Kumo's variant objects, so
    # Kumo's styles must still be missing; if this changes, update the README.
    if [ $ok = 0 ]; then pass "prefix stays unsupported: Kumo's styles don't apply ($(grep -c '^FAIL' "$work/$name.highlight.log") of 6 state checks fail, as documented)"
    else fail "prefix now styles Kumo's components; update the README"; fi
  else
    [ $ok = 1 ] || failed=1
    cat "$work/$name.highlight.log"
  fi
fi

exit $failed
