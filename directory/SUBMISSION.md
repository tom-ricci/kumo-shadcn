# Listing in the shadcn registry directory (prepared, not submitted)

The shadcn registry directory is the list of open source registries the shadcn CLI and the shadcn MCP
server know without configuration. Once listed, `npx shadcn add @kumo-shadcn/button` and
`shadcn search @kumo-shadcn` work in any project, and `@kumo-shadcn/...` registry dependencies resolve on
their own.

Nothing here has been submitted. The ready-to-copy change, checks and pull request text are in
[PR.md](PR.md); Thomas opens it.

## Requirements and status

Sources: [Registry Directory](https://ui.shadcn.com/docs/registry/registry-index),
[Namespaces](https://ui.shadcn.com/docs/registry/namespace),
[Registry Health](https://ui.shadcn.com/docs/registry/health), and the validator the directory runs
(`pnpm validate:registries`: `apps/v4/scripts/validate-registries.mts` and
`apps/v4/lib/registry-directory.ts` in shadcn-ui/ui). `npm run check-directory -w @kumo-shadcn/registry` checks every item
below that can be checked from this repository; CI runs it on every build.

| Requirement | Source | Status |
| --- | --- | --- |
| Open source and publicly accessible | Directory docs, requirement 1 | MIT, public repo; served at https://kumo-shadcn.thomasricci.dev |
| Valid registry JSON against the registry schema | Directory docs, requirement 2 | `public/r/registry.json` and every item validate (`registrySchema`, `registryItemSchema`) |
| Flat registry: `/registry.json` and `/<item>.json` at the root of the registry | Directory docs, requirement 3 | `/r/registry.json` and `/r/<item>.json`, template `.../r/{name}.json` |
| No `content` in the index's `files` | Directory docs, requirement 4 | none |
| Entry `name` matches `^@[a-zA-Z0-9][a-zA-Z0-9_-]*$`, unique in the directory | `registry-directory.ts` | `@kumo-shadcn`, not taken as of 2026-11-22 (shadcn-ui/ui `bfa64ff`) |
| `homepage`, `url` are URLs; `url` contains `{name}` | `registry-directory.ts` | yes |
| `description` and `logo` (inline SVG) present; only `name`, `homepage`, `url`, `description`, `author`, `logo` | `registry-directory.ts` | yes; `author` left out (optional) |
| HTTPS, JSON responses, unique item names, registry name matches the namespace | Health docs, "Registry setup" | Worker serves `application/json` over HTTPS; names unique; `registry.json` name `kumo-shadcn` matches `@kumo-shadcn` |
| Index online, items downloadable and valid, a sample installs with `shadcn add --dry-run` | Health docs, checks | covered by the verification apps; monitoring starts after listing |

Not stated anywhere in the docs: rules about trademarks or third-party names. See "Naming" below.

## Before submitting

1. Done: the Worker is live at https://kumo-shadcn.thomasricci.dev, and `directory/entry.json` uses it.
2. Done: the namespace is `@kumo-shadcn` (`NAMESPACE` in `packages/registry/src/config.ts`; the registry
   `name` follows it). It makes the unofficial port explicit; the docs set no trademark rules, and
   `@kumo` alone could read as Cloudflare's own registry. The logo is a neutral mark (three bars), not
   Cloudflare's or Kumo's.
3. After the listing is merged, `registryDependencies` can switch to the namespaced form
   (`node packages/registry/src/generate.ts --kumo .kumo --deps namespace`, or make it the default). Until
   then they stay full Worker URLs, because `@kumo-shadcn/...` dependencies only resolve where the
   namespace is configured or listed.
4. `npm run registry` checks everything here that this repository controls (`check-directory`).
5. Follow [PR.md](PR.md): append the entry, run `pnpm validate:registries` and the prettier check, open the PR.
