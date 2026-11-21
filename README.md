# kumo-shadcn

A [shadcn/ui registry](https://ui.shadcn.com/docs/registry) for [Kumo](https://github.com/cloudflare/kumo),
Cloudflare's React component library.

This registry is unofficial. It is not affiliated with or endorsed by Cloudflare.

## What you get

It works like shadcn/ui: `shadcn add` copies the source of a Kumo component into your project, and the
code is yours to read and change. There is no `@cloudflare/kumo` package to install.

- **49 components** (`button`, `dialog`, `select`, `chart`, ...) and **3 blocks** (`page-header`,
  `resource-list`, `delete-resource`), copied from Kumo's source.
- **Helpers** (`kumo-utils`): `cn`, variant helpers, and the link, locale and portal providers.
- **Icons** (`kumo-icons`): the icons Kumo uses, drawn with the icon library from your `components.json`.
- **Theme items**: `kumo-theme`, `kumo-cloudflare` and `kumo-binding`. Install exactly one.

Files go where your `components.json` aliases say:

| What | Where (default aliases) |
| --- | --- |
| Components | `components/ui/<name>/` (for example `components/ui/button/button.tsx`) |
| Blocks | `components/<name>/` |
| Helpers and icons | `lib/kumo/` |
| Styles | your Tailwind CSS file |

The list of items is in [`registry.json`](registry.json). The built item files are in [`public/r/`](public/r).

## Install

You need a project set up with `npx shadcn@latest init`, Tailwind CSS v4, React 18 or 19, and shadcn CLI
4.23 or later. Older CLIs don't understand the file targets this registry uses. The checks run with
4.23.0.

1. Add one theme item (see [Themes](#themes)):

   ```bash
   npx shadcn@latest add https://kumo-shadcn.<subdomain>.workers.dev/r/kumo-theme.json
   ```

2. Add components. Each one brings the components, helpers and icons it needs:

   ```bash
   npx shadcn@latest add https://kumo-shadcn.<subdomain>.workers.dev/r/button.json
   ```

   Replace `button` with any item name. You can list several URLs in one command.

The registry is served by a Cloudflare Worker (see [Hosting](#hosting)); `<subdomain>` is a placeholder
until the Worker's address is set. The same items work from GitHub, with no Worker:

```bash
npx shadcn@latest add https://raw.githubusercontent.com/tom-ricci/kumo-shadcn/main/public/r/button.json
npx shadcn@latest add tom-ricci/kumo-shadcn/button
```

Or give the registry a namespace in `components.json` (or under `"registries"` in `package.json`) and
add items by name:

```json
{
  "registries": {
    "@kumo": "https://kumo-shadcn.<subdomain>.workers.dev/r/{name}.json"
  }
}
```

```bash
npx shadcn@latest add @kumo/kumo-theme @kumo/button
```

The registry index is at `/r/registry.json`. Each item has Kumo's own title, description and category
(from Kumo's component metadata).

3. Import it:

   ```tsx
   import { Button } from "@/components/ui/button/button";

   <Button variant="primary">Deploy</Button>;
   ```

   Each component folder also has an `index.ts`. `@/components/ui/button` resolves to it, unless you
   also have shadcn's own `components/ui/button.tsx`, which `shadcn init` adds. In that case
   `@/components/ui/button` is shadcn's button, and Kumo's is `@/components/ui/button/button`. Kumo's own
   files always import each other by file, so they never pick up the wrong one.

Kumo's providers are in `lib/kumo`, for example `import { LinkProvider } from "@/lib/kumo/link-provider"`.

### TypeScript settings

The components are Kumo's code, copied as it is, with nothing suppressed. Like any shadcn component,
they have to compile under your project's settings, and a few strict settings reject parts of Kumo's code.

**Vite** (the template `shadcn init -t vite` uses, from `create-vite`): with every item added, `tsc`
reports 15 errors, and `vite build` fails.

| Setting | What Kumo does | Errors |
| --- | --- | --- |
| `erasableSyntaxOnly` | uses `enum`s and one runtime `namespace` (`banner`, `chart/Color.ts`, `date-range-picker`) | 7 × TS1294 |
| `verbatimModuleSyntax` | imports some types without `type` (`toast`, `chart/TimeseriesChart.tsx`, `page-header`) | 7 × TS1484, and `vite build` stops with 5 `MISSING_EXPORT` errors |
| `noUnusedParameters` | has one unused callback parameter (`clipboard-text`) | 1 × TS6133 |

Set those three to `false` in `tsconfig.app.json` and `tsc` and `vite build` pass. If you add only some
items, you see only the errors in their files. The exact list is in
[`scripts/verify/expected-errors-vite.txt`](scripts/verify/expected-errors-vite.txt).

**Next.js** (`shadcn init -t next`): no errors. `tsc` and `next build` pass as the template comes.

### Next.js

The copied files have `"use client"` exactly where Kumo's source has it, which is one file
(`loader/skeleton-line.tsx`). Kumo's npm package marks every file as a client module at build time; its
source doesn't. So use Kumo components from your own `"use client"` files. Rendering them directly from a
Server Component fails `next build` with "You're importing a module that depends on `createContext` into
a React Server Component module". CI checks that exact failure, and that the same components build when
used from a `"use client"` file.

### components.json options

The shadcn CLI rewrites files as it installs them, depending on `components.json`. CI installs every item
with each of these set:

| Option | Result |
| --- | --- |
| `rtl: true` | Works. The CLI turns physical classes into logical ones (`ml-2` → `ms-2`) where it can see them (in `className` and `cn(...)` there); classes in Kumo's variant objects stay physical. |
| `tsx: false` | Works. Files are written as `.js`/`.jsx`, and the app builds. |
| `rsc: false` | Works. (shadcn 4.23 leaves the one `"use client"` line in place; it does nothing outside Next.js.) |
| `tailwind.cssVariables: false` | Works with `kumo-theme` and `kumo-cloudflare`. `kumo-binding` needs `true`: it reads your shadcn CSS variables, and with `false` there are none. |
| `tailwind.prefix` | Not supported. The CLI adds the prefix to class strings in `className` attributes, but Kumo keeps most of its classes in variant objects (`classes: "..."`), which it doesn't reach. Those classes then produce no styles. |

## Themes

Every component installs `kumo-base`: Kumo's keyframes, a few helper classes, and the Tailwind setup that
makes classes like `bg-kumo-base` and `text-kumo-subtle` work. The colors themselves come from a theme
item. Install exactly one:

- **`kumo-theme`**: Kumo's own look, with Kumo's colors and type scale, as Kumo ships them. It also
  includes Kumo's `fedramp` theme (`data-theme="fedramp"`).
- **`kumo-cloudflare`**: like `kumo-theme`, plus the direction of the Cloudflare dashboard's design: one
  highlight shade for hover and selected states, and a canvas-colored sidebar (see below).
- **`kumo-binding`**: derives Kumo's colors from your shadcn variables, so Kumo components match your
  theme and your other shadcn components.

Dark mode follows shadcn's `.dark` class. `kumo-theme` and `kumo-cloudflare` also keep Kumo's own
selectors working for colors: `data-mode="dark"` and `data-theme="kumo"` / `data-theme="fedramp"`, on the
page or on part of it. The few `dark:` classes in Kumo's code (in `Switch`) follow your app's dark
variant, which is the `.dark` class in a shadcn project.

`kumo-theme` and `kumo-cloudflare` set Kumo's type scale (`text-xs` 12px, `text-sm` 13px, `text-base`
14px, `text-lg` 16px) for the whole app. That is how Kumo looks, but it also changes your other
components. `kumo-binding` leaves your type scale alone.

To switch themes, delete the old theme's rules from `@layer base` in your CSS file, then add the new
item. The CLI adds rules but doesn't remove them.

### kumo-cloudflare

Kumo has no "Cloudflare dashboard" theme. This one follows where the dashboard's design is going. It is
based on measurements from November 2026: the CSS the live dashboard loads, and a survey of 49
dashboard pages.

- The dashboard's theme tokens all have Kumo's values.
- The main sidebar uses the canvas color for its background (Kumo: base).
- The dashboard is moving all hover and selected backgrounds to one highlight shade: light 96.5%, dark
  21%, whatever surface they sit on. Kumo uses its tint color for these (97% / 26.9%). The dashboard has
  done this first in the sidebar, popovers and dialog lists. `kumo-cloudflare` applies it to every
  interactive state now.

To make that possible, the registry's copies of Kumo's components read a `--kumo-highlight` variable
first wherever a hover, highlighted, selected or open state uses the tint color (10 places in Kumo
2.19.0, listed in [`scripts/expected-highlights.txt`](scripts/expected-highlights.txt)). The sidebar also
reads `--kumo-sidebar-bg` and `--kumo-sidebar-active-bg`. Only `kumo-cloudflare` sets these, so with
`kumo-theme` or `kumo-binding` the components look exactly as Kumo ships them. You can also set
`--kumo-highlight` yourself.

The dashboard has a few other overrides on single pages (a tinted notice, table striping, a scoped brand
color). They are left out.

### kumo-binding

Each Kumo token is set from a shadcn variable. Where Kumo has more levels than shadcn (Kumo has four
surface colors, shadcn has two), the binding mixes colors with `color-mix(in oklab, ...)` to keep the
levels apart. The amounts are tuned so that, on shadcn's default neutral theme, the binding comes out
within a small distance of Kumo's own colors (most tokens within 1 ΔE; `npm run compare-themes` prints
the table). The exceptions are on purpose: brand follows your `--primary`, and focus follows your
`--ring`.

| Kumo token | Light | Dark |
| --- | --- | --- |
| canvas, elevated, recessed | `--background` mixed with 1.4 / 2.2 / 4% `--foreground` | `--background` mixed with 35 / 20 / 0% black |
| base, control | `--card`, `--background` | `--card` halfway to `--background`, `--card` |
| overlay | `--popover` with a little `--popover-foreground` | same, a bit more |
| tint, fill, fill-hover, interact | `--muted`, `--secondary` (+6% fg), `--accent`, `--accent` (+13% fg) | `--muted`, `--secondary`, `--accent`, `--accent` (+14% fg) |
| brand, brand-hover | `--primary`, brand darkened | same |
| line, hairline | `--border`, `--border` toward background | `--border` (+4% fg), `--border` |
| focus | `--ring` | `--ring` |
| danger (+ tint, text) | `--destructive` | `--destructive` |
| success, warning, info (+ tints, text, banners) | new `--success`, `--warning`, `--info` | same |
| text default, strong, subtle | `--foreground` (6% toward bg), `--foreground`, `--muted-foreground` | same, default 2% toward bg |
| text placeholder, inactive | `--muted-foreground` toward `--background` | same |
| badge colors, shadows, brand text | Kumo's values | Kumo's values |

`--success`, `--warning` and `--info` are new variables, because shadcn has none. They default to
Kumo's colors. Kumo puts white text on brand and danger fills, so where the browser supports relative
colors the binding caps their lightness (shadcn's default dark `--primary` is almost white).

Every value is set in `@layer base`, so anything you set in your own `:root` or `.dark` wins. That
includes the Kumo variables themselves (`--kumo-base`, `--kumo-text-subtle`, ...) and the three new
ones.

## Icons

Kumo's components use [Phosphor](https://phosphoricons.com) icons. Here they import them from
`@/lib/kumo/icons` instead (the only change to their icon code). That file is the `kumo-icons` item.
It exports the same names (`CheckIcon`, `X`, `CaretDownIcon`, ...) plus Phosphor's `Icon` type,
`IconProps` and `IconContext`. Each icon is written with shadcn's `IconPlaceholder`, so the shadcn CLI
swaps in the icon library set as `iconLibrary` in your `components.json` when it writes the file:
lucide, tabler, hugeicons, phosphor or remixicon.

- Set `iconLibrary` before you add Kumo components, and install that library's package. `shadcn init`
  does both. If you change libraries later, run `npx shadcn@latest migrate icons` to switch the
  package, then re-add `kumo-icons` with `--overwrite`.
- Phosphor's props still work: `size` (default `1em`, as in Phosphor), `weight` (becomes a stroke width),
  `mirrored` and `color`. Kumo's `icon={...}` props take a shim icon, an icon from your library, or any
  element.

| Kumo (Phosphor) | lucide | tabler | hugeicons | remixicon |
| --- | --- | --- | --- | --- |
| ArrowRight | ArrowRightIcon | IconArrowRight | ArrowRight02Icon | RiArrowRightLine |
| ArrowSquareOut | ExternalLinkIcon | IconExternalLink | LinkSquare02Icon | RiExternalLinkLine |
| ArrowsClockwise | RefreshCwIcon | IconRefresh | RefreshIcon | RiRefreshLine |
| CaretDoubleLeft | ChevronsLeftIcon | IconChevronsLeft | ArrowLeftDoubleIcon | RiArrowLeftDoubleLine |
| CaretDoubleRight | ChevronsRightIcon | IconChevronsRight | ArrowRightDoubleIcon | RiArrowRightDoubleLine |
| CaretDown | ChevronDownIcon | IconChevronDown | ArrowDown01Icon | RiArrowDownSLine |
| CaretLeft | ChevronLeftIcon | IconChevronLeft | ArrowLeft01Icon | RiArrowLeftSLine |
| CaretRight | ChevronRightIcon | IconChevronRight | ArrowRight01Icon | RiArrowRightSLine |
| CaretUp | ChevronUpIcon | IconChevronUp | ArrowUp01Icon | RiArrowUpSLine |
| CaretUpDown | ChevronsUpDownIcon | IconSelector | UnfoldMoreIcon | RiExpandUpDownLine |
| Check | CheckIcon | IconCheck | Tick02Icon | RiCheckLine |
| CheckCircle | CircleCheckIcon | IconCircleCheck | CheckmarkCircle02Icon | RiCheckboxCircleLine |
| Copy, CopySimple | CopyIcon | IconCopy | Copy01Icon | RiFileCopyLine |
| Eye | EyeIcon | IconEye | ViewIcon | RiEyeLine |
| EyeSlash | EyeOffIcon | IconEyeOff | ViewOffIcon | RiEyeOffLine |
| GlobeHemisphereWest | EarthIcon | IconWorld | Globe02Icon | RiEarthLine |
| Info | InfoIcon | IconInfoCircle | InformationCircleIcon | RiInformationLine |
| MagnifyingGlass | SearchIcon | IconSearch | Search01Icon | RiSearchLine |
| Minus | MinusIcon | IconMinus | MinusSignIcon | RiSubtractLine |
| Warning | TriangleAlertIcon | IconAlertTriangle | Alert02Icon | RiAlertLine |
| WarningCircle | CircleAlertIcon | IconAlertCircle | AlertCircleIcon | RiErrorWarningLine |
| WarningOctagon | OctagonAlertIcon | IconAlertOctagon | OctagonAlertIcon | RiSpam2Line |
| X | XIcon | IconX | Cancel01Icon | RiCloseLine |

With phosphor as your `iconLibrary` you get the original icons (`CheckIcon` and so on). The mapping is
in [`scripts/icons.ts`](scripts/icons.ts).

## How updates work

A workflow ([`update.yml`](.github/workflows/update.yml)) runs every day. It takes the source of the
latest Kumo release, regenerates the registry, and installs every item with the real shadcn CLI into fresh
Vite and Next.js apps (lucide, tabler and hugeicons; all three themes; default and custom aliases; the
`components.json` options above). In
each app, the template as it comes must report exactly the errors listed under
[TypeScript settings](#typescript-settings), so a change in either direction is noticed. With those
settings relaxed, `tsc --noEmit` and a production build must pass. In the Vite apps, a headless Chrome
also hovers a button, a dropdown item and a sidebar item and checks their backgrounds against the theme.
It also checks the registry against the shadcn registry directory's requirements
([`directory/SUBMISSION.md`](directory/SUBMISSION.md)). Only then does it commit the new registry to
`main` and deploy it to the Worker. If anything fails,
nothing is published and the run fails.

So when Kumo adds or changes a component, the next `shadcn add` gives you the new version. Like any
shadcn component, your copy doesn't change by itself: run `shadcn add <item> --overwrite` to take an
update. That replaces your edits to those files, so check the diff.

### How the registry is generated

[`scripts/generate.ts`](scripts/generate.ts) reads Kumo's source with the TypeScript compiler and
PostCSS. It never runs Kumo's code, and it uses no AI. For each component it:

- copies the source files (not tests or stories);
- rewrites imports: other components to `@/components/ui/<name>/<file>`, helpers to `@/lib/kumo/<file>`,
  Phosphor to `@/lib/kumo/icons`; the CLI then maps these through your aliases;
- lists the npm packages the files import, with the version ranges Kumo declares;
- lists the other items it needs as `registryDependencies` (full item URLs, which work without any
  configuration; `--deps namespace` writes `@kumo/<item>` instead, for once the namespace is listed in
  the shadcn registry directory);
- takes each item's title, description and category from Kumo's `ai/component-registry.json` (in Kumo's
  npm package of the same version);
- turns Kumo's CSS files into `kumo-base` and the theme items.

Kumo's class names and logic are not changed, and nothing is suppressed (no `@ts-ignore`, no lint
comments, no casts). Each file's header lists the edits: import paths, and the highlight and sidebar
hooks above. `"use client"` is exactly where Kumo's source has it. `lib/kumo/process-env.d.ts` gives `process.env.NODE_ENV`, which Kumo
reads for development warnings, a type in apps without `@types/node`.

The generator stops with an error instead of guessing: on an icon with no mapping
(`unmapped icon: X`), an import it can't place, a package Kumo doesn't declare, or a type error under
`strict` and `isolatedModules`.

### Developing

```bash
npm ci --ignore-scripts
npm run fetch-kumo      # download the latest Kumo release into .kumo/
npm run registry        # generate, shadcn build, type-check, check the icon shim
npm run verify -- vite lucide kumo-theme   # one test app: framework, icon library, theme [aliases] [items]
```

## Hosting

The registry is static JSON in `public/`. A Cloudflare Worker serves it with
[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), configured in
[`wrangler.jsonc`](wrangler.jsonc). There is no Worker script: [`public/_headers`](public/_headers) adds
CORS (`Access-Control-Allow-Origin: *`) and a five-minute cache to `/r/*`, item files are served as
`application/json`, and [`public/_redirects`](public/_redirects) sends `/` to this repository.

The update workflow deploys it from `main` after every successful run. To turn that on, add two
repository secrets (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN`: an API token for your account with the **Workers Scripts: Edit** permission
  (Cloudflare dashboard → My Profile → API Tokens → Create Token).
- `CLOUDFLARE_ACCOUNT_ID`: your account ID (shown on the Workers & Pages overview).

Until they exist, the deploy step is skipped with a notice and the rest of the workflow runs as usual.
The first deploy creates the Worker `kumo-shadcn` at `https://kumo-shadcn.<subdomain>.workers.dev`, where
`<subdomain>` is your account's workers.dev subdomain. A custom domain is optional (Worker → Settings →
Domains & Routes). Once the address is settled, replace the placeholder in the install commands above.

Items refer to each other (`registryDependencies`) through the raw GitHub URLs, so they work from any of
the three addresses. To point them at the Worker instead, change `DEFAULT_BASE_URL` in
`scripts/generate.ts` and `PROD` in `scripts/serve-registry.ts`.

## License

The code in this repository that was written here (the generator, the icon shim, the theme items, the
scripts) is released under the [MIT License](LICENSE), copyright (c) 2026 Thomas Ricci.

The component, block and helper files in `registry/kumo` and `public/r` are copied from Kumo, which is
also MIT licensed, copyright (c) 2026 Cloudflare, Inc. Each copied file carries Kumo's full license
notice, right after its first statement: the shadcn CLI removes comments that come before a file's first
statement when it installs it, and keeps the ones after. The text is also in [`registry/kumo/LICENSE-KUMO`](registry/kumo/LICENSE-KUMO). Keep those
headers when you change the files in your project.

The MIT License does not grant trademark rights. "Cloudflare", "Kumo" and the Cloudflare logo (which the
`cloudflare-logo` item contains) belong to Cloudflare, Inc.
