# Listing in the shadcn registry directory (prepared, not submitted)

The shadcn registry directory is the list of open source registries the shadcn CLI and the shadcn MCP
server know without configuration. Once listed, `npx shadcn add @kumo/button` and `shadcn search @kumo`
work in any project, and `@kumo/...` registry dependencies resolve on their own.

Nothing here has been submitted. Opening the pull request below needs Thomas's approval.

## Requirements and status

Sources: [Registry Directory](https://ui.shadcn.com/docs/registry/registry-index),
[Namespaces](https://ui.shadcn.com/docs/registry/namespace),
[Registry Health](https://ui.shadcn.com/docs/registry/health), and the validator the directory runs
(`pnpm validate:registries`: `apps/v4/scripts/validate-registries.mts` and
`apps/v4/lib/registry-directory.ts` in shadcn-ui/ui). `npm run check-directory` checks every item
below that can be checked from this repository; CI runs it on every build.

| Requirement | Source | Status |
| --- | --- | --- |
| Open source and publicly accessible | Directory docs, requirement 1 | MIT, public repo. Public URL: the Worker, once deployed. |
| Valid registry JSON against the registry schema | Directory docs, requirement 2 | `public/r/registry.json` and every item validate (`registrySchema`, `registryItemSchema`) |
| Flat registry: `/registry.json` and `/<item>.json` at the root of the registry | Directory docs, requirement 3 | `/r/registry.json` and `/r/<item>.json`, template `.../r/{name}.json` |
| No `content` in the index's `files` | Directory docs, requirement 4 | none |
| Entry `name` matches `^@[a-zA-Z0-9][a-zA-Z0-9_-]*$`, unique in the directory | `registry-directory.ts` | `@kumo`, not taken as of 2026-11-21 |
| `homepage`, `url` are URLs; `url` contains `{name}` | `registry-directory.ts` | yes |
| `description` and `logo` (inline SVG) present; only `name`, `homepage`, `url`, `description`, `author`, `logo` | `registry-directory.ts` | yes; `author` left out (optional) |
| HTTPS, JSON responses, unique item names, registry name matches the namespace | Health docs, "Registry setup" | Worker serves `application/json` over HTTPS; names unique; `registry.json` name `kumo` matches `@kumo` |
| Index online, items downloadable and valid, a sample installs with `shadcn add --dry-run` | Health docs, checks | covered by the verification apps; monitoring starts after listing |

Not stated anywhere in the docs: rules about trademarks or third-party names. See "Naming" below.

## Before submitting

1. Deploy the Worker (secrets in the README, Hosting) and replace `SUBDOMAIN` in `directory/entry.json`
   with the real address, or use a custom domain.
2. Decide the namespace (see "Naming"). If it changes, change `NAMESPACE` in `scripts/generate.ts`,
   the registry `name` in `scripts/generate.ts` (it must match), and `name` in `directory/entry.json`.
3. After the listing is merged, switch `registryDependencies` to the namespaced form
   (`node scripts/generate.ts --deps namespace`, or make it the default). Until then they stay full URLs,
   because `@kumo/...` dependencies only resolve where `@kumo` is configured or listed.
4. Run `npm run registry` (includes `check-directory`).

## Naming

The docs set no trademark rules, but Kumo is Cloudflare's product name and this registry is unofficial.
`@kumo` in a public, unconfigured namespace list can read as Cloudflare's own registry. Options:

- `@kumo`: what this repository uses now; shortest; the description says "Unofficial" and "Not
  affiliated with Cloudflare".
- `@kumo-shadcn`: matches the repository name and makes the port explicit. Recommended if there is any
  doubt.

The logo is a neutral mark (three bars), not Cloudflare's or Kumo's logo.

## The change (shadcn-ui/ui, `apps/v4/registry/directory.json`)

New entries go at the end of the array (as recent additions do):

```diff
     ...
-  }
+  },
+  {
+    "name": "@kumo",
+    "homepage": "https://github.com/tom-ricci/kumo-shadcn",
+    "url": "https://kumo-shadcn.SUBDOMAIN.workers.dev/r/{name}.json",
+    "description": "Unofficial registry for Kumo, Cloudflare's React component library: Kumo's component source with your aliases and icon library, and a theme that follows your shadcn variables. Not affiliated with Cloudflare.",
+    "logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='currentColor'><rect x='4' y='6' width='24' height='5' rx='2.5'/><rect x='4' y='13.5' width='18' height='5' rx='2.5'/><rect x='4' y='21' width='12' height='5' rx='2.5'/></svg>"
+  }
 ]
```

The entry is kept in [`entry.json`](entry.json).

## Pull request

Title: `feat(registry): add @kumo to the registry directory`

Body:

```
Adds an unofficial registry for Kumo (Cloudflare's React component library) under the `@kumo` namespace.

- Homepage: https://github.com/tom-ricci/kumo-shadcn
- Registry: https://kumo-shadcn.SUBDOMAIN.workers.dev/r/{name}.json
- Generated daily from Kumo's latest release; every item is installed with the shadcn CLI into fresh Vite and Next.js apps before it is published
- Not affiliated with or endorsed by Cloudflare; MIT, with Kumo's MIT notice in every copied file
- Logo: a neutral mark using `currentColor`

## Verification

- `pnpm validate:registries`
- `pnpm prettier --check apps/v4/registry/directory.json`
```
