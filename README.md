# kumo-shadcn

A [shadcn](https://ui.shadcn.com) registry for [Kumo](https://kumo-ui.com), Cloudflare's React component
library. Like any shadcn component, each Kumo component is copied into your project as source. No more
installing `@cloudflare/kumo`!

Not affiliated with or endorsed by Cloudflare.

Docs: https://kumo-shadcn.thomasricci.dev · Browse the components: https://kumo-ui.com

## Install

Start from a shadcn project with CLI version 4.23 or later, choose a theme, and add your components. Any
of these works:

```bash
# by URL
npx shadcn@latest add https://kumo-shadcn.thomasricci.dev/r/kumo-theme.json
npx shadcn@latest add https://kumo-shadcn.thomasricci.dev/r/button.json

# by GitHub repo
npx shadcn@latest add tom-ricci/kumo-shadcn/kumo-theme
npx shadcn@latest add tom-ricci/kumo-shadcn/button
```

Or add the namespace to `components.json`:

```jsonc
{
  "registries": {
    "@kumo-shadcn": "https://kumo-shadcn.thomasricci.dev/r/{name}.json"
  }
}
```

```bash
npx shadcn@latest add @kumo-shadcn/kumo-theme
npx shadcn@latest add @kumo-shadcn/button
```

Then import your components:

```tsx
import { Button } from "@/components/ui/button/button"
```

The full list of items is in https://kumo-shadcn.thomasricci.dev/r/registry.json. Kumo's providers
(link, locale, portal) are in `@/lib/kumo`, e.g. `import { LinkProvider } from "@/lib/kumo/link-provider"`.

## Themes

Kumo isn't directly shadcn compatible: it uses its own design tokens, which don't map perfectly onto
shadcn's. So the registry provides a few themes. Install exactly one. Each pulls in `kumo-base` and builds
on it. `kumo-base` avoids touching *your* CSS: everything it adds is named `kumo-…`, so your `text-sm`,
`transition` and class names stay yours.

- **`kumo-theme`**: Kumo's default theme.
- **`kumo-cloudflare`**: Cloudflare's products use slightly different colors than Kumo's defaults (one
  highlight shade for hover/selected states, a canvas-colored sidebar). This is that.
- **`kumo-binding`**: derives Kumo's design tokens from your shadcn tokens. It's a slightly lossy
  conversion, but tuned to look good.

To switch themes, delete the old theme's rules from `@layer base` in your CSS file, then add the new one
(the CLI adds rules but never removes them).

**Button bevel.** Kumo's primary and destructive buttons have a bevel. Set `--kumo-button-bevel` to `0`
for flat buttons (`1` or unset is Kumo's bevel; values in between scale it). It's an inherited CSS
variable, so set it on `:root`, on part of the page, or on one button (`className="[--kumo-button-bevel:0]"`).

## Icons

Kumo uses Phosphor icons. shadcn lets you choose an icon library, so every Phosphor icon Kumo uses is
mapped to Lucide, Tabler, Hugeicons and Remix Icon too. kumo-shadcn uses whichever library is set as
`iconLibrary` in `components.json`, so set it (and install its package; `shadcn init` does both) before
adding Kumo components. To switch later, run `npx shadcn@latest migrate icons`, then re-add `kumo-icons`
with `--overwrite`.

## Caveats

- **Vite's strict TypeScript settings.** Kumo's code is copied as it is. Vite's default tsconfig rejects
  parts of it: set `erasableSyntaxOnly`, `verbatimModuleSyntax` and `noUnusedParameters` to `false` in
  `tsconfig.app.json`. Next.js builds as the template comes.
- **React Server Components.** Kumo doesn't mark its components with `"use client"`, so render them from
  your own client components, not directly from a Server Component.
- **Tailwind prefix isn't supported.** Kumo keeps most of its classes in variant objects that the shadcn
  CLI's prefix transform doesn't reach, so those classes produce no styles.
- **`kumo-binding` requires CSS variables.** It reads your shadcn variables, so `tailwind.cssVariables`
  must be `true` in `components.json`.

## Updates

The registry is kept up to date with upstream Kumo: CI rebuilds it every day from the latest Kumo release,
and new or changed components are ported automatically and tested before anything is published. Like any
shadcn component, your copy doesn't change by itself: run `shadcn add <item> --overwrite` to take an
update, and check the diff.

## Development

Read [CONTRIBUTING.md](CONTRIBUTING.md) first: it has the rules for changes, including what to do when a Kumo release fails CI.

A [Turborepo](https://turborepo.com) with npm workspaces:

| Path | What |
| --- | --- |
| `packages/registry` | The generator and registry tooling: fetch Kumo, generate, `shadcn build`, type-check, icon and directory checks |
| `apps/site` | The docs page, built with the registry itself |
| `packages/verify` | The test harness: real shadcn-CLI installs into fresh Vite and Next.js apps, plus the Worker check |
| `registry.json`, `registry/`, `public/`, `wrangler.jsonc` | What gets published. They stay at the repo root because the raw GitHub URLs, the `tom-ricci/kumo-shadcn/<item>` shorthand and the Worker read them there |

```bash
npm ci --ignore-scripts
npm run registry   # fetch the latest Kumo release, generate, shadcn build, type-check, icon and directory checks
npm run site       # the same, plus the docs page
npm run dev        # the docs page's dev server, from registry.json and registry/ in the checkout
npm run check      # everything, plus wrangler dev on the result
npm run verify -- vite lucide kumo-theme   # one test app: framework, icon library, theme [aliases] [items|-] [transform]
npm run compare-themes -w @kumo-shadcn/registry   # how close kumo-binding gets to Kumo's colors
```

Turbo runs `fetch-kumo` → `generate` → `build` → the docs page → `check-worker`, with the checks after
`generate`/`build`. `fetch-kumo` never caches; `generate`'s cache key includes the Kumo source it reads, so
a new Kumo release rebuilds everything after it. CI runs with `--force`.

### How the registry is generated

[`packages/registry/src/generate.ts`](packages/registry/src/generate.ts) reads Kumo's source with the
TypeScript compiler and PostCSS. It never runs Kumo's code and uses no AI. Per component it:

- copies the source files (not tests or stories) and rewrites imports: components to
  `@/components/ui/<name>/<file>`, helpers to `@/lib/kumo/<file>`, `cn` to `@/lib/utils`, Phosphor to
  `@/lib/kumo/icons` (the icon shim, mapping in [`icons.ts`](packages/registry/src/icons.ts));
- lists npm dependencies with Kumo's declared ranges, and other items as `registryDependencies` by Worker
  URL (`--deps namespace` writes `@kumo-shadcn/<item>` instead);
- takes titles, descriptions and categories from Kumo's `ai/component-registry.json`;
- turns Kumo's CSS into `kumo-base` and the theme items, namespacing everything (`kumo-` classes,
  keyframes, custom properties; Tailwind's type scale and default duration become `--kumo-font-size-*`,
  `--kumo-line-height-*`, `--kumo-transition-duration`) and rewriting Kumo's code to match (`text-sm` →
  `text-(length:--kumo-font-size-sm)/[…]`, which `cn` still merges as a size).

Kumo's logic isn't changed and nothing is suppressed (no `@ts-ignore`, lint comments or casts). The only
class-name edits are namespacing and three hooks: `--kumo-highlight` (hover/selected states, set by
`kumo-cloudflare`), the sidebar's `--kumo-sidebar-bg`/`--kumo-sidebar-active-bg`, and the
`--kumo-button-bevel` source patch (`SOURCE_PATCHES`). Every rewrite is listed in
`packages/registry/src/expected-*.txt`; when a Kumo release changes what matches, generation fails until
the list is reviewed (`KUMO_RECORD=1` rewrites them). Anything an item writes outside Kumo's names fails
the build unless [`allowed-globals.txt`](packages/registry/src/allowed-globals.txt) lists it with a reason
(only `color-scheme`, which can't be namespaced). Each copied file's header lists its edits.

The generator stops instead of guessing: on an unmapped icon, an import it can't place, a package Kumo
doesn't declare, or a type error under `strict` and `isolatedModules`.

`kumo-binding` maps each Kumo token from a shadcn variable, using `color-mix(in oklab, …)` where Kumo has
more levels than shadcn (e.g. four surfaces vs two). Brand follows `--primary`, focus `--ring`; status
colors read `--success`/`--warning`/`--info` if your theme defines them, else Kumo's. Everything is set in
`@layer base`, so a user's own `:root`/`.dark` wins.

### CI

[`update.yml`](.github/workflows/update.yml) runs daily: it regenerates from the latest Kumo release and
installs every item with the real shadcn CLI into fresh Vite and Next.js apps (lucide, tabler and
hugeicons; all three themes; default and custom aliases; `rtl`, `tsx: false`, `rsc: false`,
`cssVariables: false`). Each app must report exactly the TypeScript errors in
[`packages/verify/expected-errors-vite.txt`](packages/verify/expected-errors-vite.txt), then build with
those settings relaxed; headless Chrome checks hover backgrounds against the theme. It also checks the
shadcn registry directory's requirements. Only if everything passes does it commit the registry to `main`
and deploy it.

### Hosting

A Cloudflare Worker serves `public/` with
[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) (no Worker script),
configured in [`wrangler.jsonc`](wrangler.jsonc): the registry under `/r/` (committed) and the docs page
at `/` (built by [`apps/site/build.sh`](apps/site/build.sh), not committed; it installs its components
from the freshly built registry, so it's a test too). [`public/_headers`](public/_headers) adds CORS and a
five-minute cache to `/r/*`. The domain is https://kumo-shadcn.thomasricci.dev.

The workflow deploys from `main` when two repository secrets exist: `CLOUDFLARE_API_TOKEN` (Workers
Scripts: Edit) and `CLOUDFLARE_ACCOUNT_ID`. Without them the deploy step is skipped. The address, the
namespace and the repository URL are set in one place:
[`packages/registry/src/config.ts`](packages/registry/src/config.ts).

## License

The registry's own code is [MIT](LICENSE) licensed. The component files are copied from Kumo, which is
also MIT licensed, copyright Cloudflare, Inc.; each file ships with Cloudflare's original license notice
(placed after the file's first statement, because the shadcn CLI drops comments before it), also in
[`registry/kumo/LICENSE-KUMO`](registry/kumo/LICENSE-KUMO). Keep those headers when you change the files.
"Cloudflare" and "Kumo" are Cloudflare's trademarks.
