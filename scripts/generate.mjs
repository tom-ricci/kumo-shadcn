#!/usr/bin/env node
// Generates registry.json and the thin wrapper files in registry/kumo/ from the
// installed @cloudflare/kumo package. It reads the package's package.json and
// built files as text only; it never imports or executes Kumo code.
//
// Usage: node scripts/generate.mjs
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kumoDir = join(root, "node_modules", "@cloudflare", "kumo");
const kumoPkg = JSON.parse(readFileSync(join(kumoDir, "package.json"), "utf8"));
const outDir = join(root, "registry", "kumo");

const HOMEPAGE = "https://github.com/tom-ricci/kumo-shadcn";
const SOURCE_GLOB = "../node_modules/@cloudflare/kumo/dist/**/*.{js,jsx,ts,tsx}";

// Peer dependencies Kumo needs for every component. Optional peers (echarts,
// zod) are added only to the items whose code imports them.
const requiredPeers = Object.keys(kumoPkg.peerDependencies ?? {})
  .filter((name) => !kumoPkg.peerDependenciesMeta?.[name]?.optional)
  .filter((name) => name !== "react" && name !== "react-dom")
  .sort();
const optionalPeers = Object.keys(kumoPkg.peerDependencies ?? {})
  .filter((name) => kumoPkg.peerDependenciesMeta?.[name]?.optional)
  .sort();

// Every component item carries the full setup, so each JSON file works on its
// own (local file, raw URL, Pages, or GitHub address). shadcn merges repeated
// dependencies and CSS rules.
const setup = {
  dependencies: ["@cloudflare/kumo", ...requiredPeers],
  css: {
    [`@source "${SOURCE_GLOB}"`]: {},
    '@import "@cloudflare/kumo/styles/tailwind"': {},
  },
};

const setupDocs =
  `Kumo needs Tailwind CSS v4. Your Tailwind CSS file now has @import "@cloudflare/kumo/styles/tailwind" and @source "${SOURCE_GLOB}". That @source path assumes the CSS file is one folder below node_modules (app/globals.css, src/index.css); fix it if yours is deeper. See ${HOMEPAGE}#styles`;

const pascal = (s) => s.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

// Names exported by a component entry, read from its .d.ts ("type X" excluded).
function valueExports(name) {
  const dts = readFileSync(join(kumoDir, "dist", "components", `${name}.d.ts`), "utf8");
  const names = [];
  for (const m of dts.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(",")) {
      const item = part.trim();
      if (!item || item.startsWith("type ")) continue;
      names.push(item.split(/\s+as\s+/).pop().trim());
    }
  }
  return [...new Set(names)];
}

// Bare module specifiers reachable from a component entry through Kumo's own
// relative imports (its chunks), used to find optional peers like echarts.
function bareImports(entryFile) {
  const seen = new Set();
  const bare = new Set();
  const queue = [entryFile];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/(?:import|export)\s*(?:[^"'`;]*?\sfrom\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
      const spec = m[1] ?? m[2];
      if (spec.startsWith(".")) queue.push(resolve(dirname(file), spec));
      else bare.add(spec);
    }
  }
  return bare;
}

function peerFor(spec) {
  return optionalPeers.find((p) => spec === p || spec.startsWith(`${p}/`));
}

const components = Object.keys(kumoPkg.exports)
  .filter((key) => key.startsWith("./components/"))
  .map((key) => key.slice("./components/".length))
  .filter((name) => /^[a-z0-9-]+$/.test(name))
  .sort();

rmSync(outDir, { recursive: true, force: true });
rmSync(join(root, "public", "r"), { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const items = [
  {
    name: "kumo",
    type: "registry:item",
    title: "Kumo setup",
    description:
      "Installs @cloudflare/kumo and its peer dependencies and adds Kumo's Tailwind v4 styles to your CSS. Every component item includes this setup too.",
    ...setup,
    docs: setupDocs,
  },
];

for (const name of components) {
  const exports = valueExports(name);
  const extraPeers = [
    ...new Set(
      [...bareImports(join(kumoDir, "dist", "components", `${name}.js`))]
        .map(peerFor)
        .filter(Boolean),
    ),
  ].sort();
  const file = `registry/kumo/${name}.tsx`;
  writeFileSync(
    join(root, file),
    [
      `// Kumo ${pascal(name)}, installed from the kumo-shadcn registry (${HOMEPAGE}).`,
      "// The component itself lives in the @cloudflare/kumo npm package, so updating",
      "// that package updates it. This file only re-exports it.",
      `export * from "@cloudflare/kumo/components/${name}";`,
      "",
    ].join("\n"),
  );
  items.push({
    name,
    type: "registry:ui",
    title: pascal(name),
    description: `Kumo ${pascal(name)}: re-exports ${exports.join(", ") || "the component"} from @cloudflare/kumo/components/${name}.`,
    dependencies: [...setup.dependencies, ...extraPeers],
    css: setup.css,
    docs: setupDocs,
    files: [{ path: file, type: "registry:ui" }],
  });
}

const registry = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "kumo",
  homepage: HOMEPAGE,
  items,
};
writeFileSync(join(root, "registry.json"), `${JSON.stringify(registry, null, 2)}\n`);
console.log(
  `Generated ${components.length} components from @cloudflare/kumo@${kumoPkg.version} (+ kumo setup item).`,
);
