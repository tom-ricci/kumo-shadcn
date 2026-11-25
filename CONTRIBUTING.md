# Contributing

Read this before changing the registry, and when a Kumo release makes CI fail. The README's
"Development" section covers the layout and commands.

## The rules

- **Kumo's code is copied, not changed.** The generator only namespaces names and applies the
  hooks listed in the README. No `@ts-ignore`, lint comments or casts, and no other edits to
  Kumo's source.
- **kumo-binding binds every Kumo token.** Its whole point is that Kumo follows the user's shadcn
  theme. So every color token Kumo has must be mapped in `packages/registry/src/themes.ts`
  (`binding`, both `light` and `dark`). A token with no mapping fails generation. Only tokens
  whose Kumo value is meant to stay (fixed hues like the colored badges, or brand values) go in
  `keepKumo`, with a reason in the comment next to them.
- **The expected lists are reviewed, never just regenerated.** When a Kumo release changes what
  the rewrites match, generation fails on a `packages/registry/src/expected-*.txt` file. Run
  `KUMO_RECORD=1 npm run generate -w @kumo-shadcn/registry`, read the diff, and only commit it
  once every change is explained: moved lines, or a real upstream change you've checked.
- **Nothing writes outside Kumo's names** unless `packages/registry/src/allowed-globals.txt`
  lists it with a reason.
- **The generator stops instead of guessing.** An unmapped icon, an import it can't place, a
  package Kumo doesn't declare or a type error is a failure to fix at its cause.

## When a new Kumo release fails CI

1. Run `npm run registry` locally. It fetches the latest Kumo release and shows the same error.
2. Fix the cause by the rules above:
   - a new token: map it in kumo-binding;
   - drift: review it and record it;
   - a new component: check its icons, imports and dependencies.
3. In the pull request, say what changed upstream and why each change is right.
EOF
