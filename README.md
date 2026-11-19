# kumo-shadcn

A [shadcn/ui registry](https://ui.shadcn.com/docs/registry) for [Kumo](https://github.com/cloudflare/kumo),
Cloudflare's React component library (`@cloudflare/kumo` on npm).

Kumo is a Cloudflare project. This registry is unofficial and not affiliated with or endorsed by Cloudflare.

## What you get

Every Kumo component (`@cloudflare/kumo/components/*`) is a registry item. Adding one:

- installs `@cloudflare/kumo` and its peer dependency `@phosphor-icons/react` (plus `echarts` for `chart`),
- adds Kumo's Tailwind v4 styles to your CSS file (see [Styles](#styles)),
- writes a one-line file such as `components/ui/button.tsx`:

  ```ts
  export * from "@cloudflare/kumo/components/button";
  ```

So you import from `@/components/ui/button` like any shadcn component, but the code itself stays in the
npm package. Nothing is copied into your project, and `npm update @cloudflare/kumo` updates every component.

There is also a `kumo` item that does only the setup (dependencies and styles), with no component file.

## Install

```bash
npx shadcn@latest add https://raw.githubusercontent.com/tom-ricci/kumo-shadcn/main/public/r/button.json
```

Replace `button` with any item name. The list is in [`registry.json`](registry.json), and the built
files are in [`public/r/`](public/r). You can add several items at once:

```bash
npx shadcn@latest add \
  https://raw.githubusercontent.com/tom-ricci/kumo-shadcn/main/public/r/dialog.json \
  https://raw.githubusercontent.com/tom-ricci/kumo-shadcn/main/public/r/input.json
```

Recent shadcn CLIs (tested with 4.23) can also read the registry straight from GitHub:

```bash
npx shadcn@latest add tom-ricci/kumo-shadcn/button
```

Your project needs a `components.json` (`npx shadcn@latest init`), React 18 or 19 and Tailwind CSS v4.

### Styles

Each item adds two lines to the Tailwind CSS file named in your `components.json`:

```css
@import "@cloudflare/kumo/styles/tailwind";
@source "../node_modules/@cloudflare/kumo/dist/**/*.{js,jsx,ts,tsx}";
```

Tailwind does not scan `node_modules`, so `@source` is what makes it generate the classes Kumo's
components use. The path is relative to your CSS file. It is right for `app/globals.css` (Next.js) and
`src/index.css` (Vite). If your CSS file is deeper, for example `src/app/globals.css`, change it to
`../../node_modules/...`. In a monorepo, point it at wherever `@cloudflare/kumo` is installed.

Not using Tailwind? Skip the CSS changes and import Kumo's precompiled stylesheet instead:
`import "@cloudflare/kumo/styles/standalone";`.

### Next.js App Router

Kumo's components are client components (they ship with `"use client"`), and you can render them from
Server Components. Compound parts accessed with a dot, such as `Dialog.Root`, and render-prop functions
only work inside a `"use client"` file. From a Server Component, use the named exports Kumo provides
instead (for example `DialogRoot`, `DialogTrigger`, `DialogTitle`).

## How updates flow

- **Component code** comes from npm. Your installed `components/ui/*.tsx` files only re-export
  `@cloudflare/kumo`, so updating that package in your project updates the components. You never need
  to re-run `shadcn add` for a Kumo release.
- **The registry** is generated from Kumo itself. `scripts/generate.mjs` reads the installed package's
  `package.json` exports and type declarations, then writes `registry.json` and one wrapper per
  `./components/*` entry point. `shadcn build` turns that into `public/r/*.json`. A Kumo release that
  adds a component therefore adds a registry item without anyone editing this repo.
- **Automation**: `.github/workflows/update.yml` runs daily and on demand. It bumps `@cloudflare/kumo` to
  the latest release, regenerates, builds, type-checks every wrapper against the new package and
  commits to `main` if anything changed.

To regenerate by hand:

```bash
npm ci --ignore-scripts
npm run registry   # generate + shadcn build + type-check
```

## Hosting

The registry is static JSON, so any static host works. The raw GitHub URLs above work with no setup.
To serve it from a nicer URL:

- **GitHub Pages**: in the repository settings, under Pages, set the source to "GitHub Actions".
  Then run the "Deploy to GitHub Pages" workflow once from the Actions tab. After that,
  `.github/workflows/pages.yml` republishes `public/` after every push to `main` that changes it and
  after every update run. Items will be at `https://tom-ricci.github.io/kumo-shadcn/r/<name>.json`.
- **Cloudflare Pages**: create a Pages project connected to this repository, with no build command and
  `public` as the output directory.

## License

The code in this repository (the generator, the wrapper files and the generated registry JSON) is
released under the [MIT License](LICENSE), copyright (c) 2026 Thomas Ricci.

This repository contains no code, styles, design tokens or documentation from Kumo. The wrappers and
item descriptions are written here, and the generator reads Kumo's package only to learn the names of
its entry points and exports. Kumo itself reaches your project from npm, under its own MIT license
(copyright Cloudflare, Inc.), and that license file ships inside the package
(`node_modules/@cloudflare/kumo/LICENSE`). A dependency's license notice therefore doesn't have to be
repeated here. If this registry ever ships files copied from Kumo, it will include Cloudflare's license
text alongside them.

The MIT License does not grant trademark rights. "Cloudflare", "Kumo" and the Cloudflare logo (which
the `cloudflare-logo` item re-exports from Kumo) belong to Cloudflare, Inc.
