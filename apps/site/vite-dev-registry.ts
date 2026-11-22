// Dev server only (npm run dev). The page's Kumo components are not in this
// checkout: build.sh installs them with the shadcn CLI in its build directory.
// This plugin lets `vite` run without that install, by doing in memory what
// `shadcn add` writes to disk, from registry.json and registry/kumo at the
// repository root:
//
//   - an import of a file the CLI would install (src/components/ui/...,
//     src/lib/kumo/...) resolves to the registry's source of that file;
//   - the theme CSS the CLI merges into src/index.css is appended to it;
//   - <IconPlaceholder />, which the CLI replaces with an icon from
//     iconLibrary, renders that icon.
//
// Only the items in kumo-items.txt and what they depend on are available, as
// in the build. The build does not use this file.
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

type CssNode = { [key: string]: string | CssNode };
type Item = {
  name: string;
  type: string;
  registryDependencies?: string[];
  files?: { path: string; target: string }[];
  cssVars?: Record<string, Record<string, string>>;
  css?: CssNode;
};

const site = dirname(fileURLToPath(import.meta.url));
const repo = resolve(site, "../..");
const registryFile = resolve(repo, "registry.json");
const itemsFile = resolve(site, "kumo-items.txt");
const ICONS = "\0kumo-dev:icon-placeholder";

const json = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const withoutExtension = (file: string) => file.replace(/\.tsx?$/, "");

function toCss(node: CssNode, indent = ""): string {
  let out = "";
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") {
      if (key.startsWith("@")) throw new Error(`kumo dev: css entry "${key}" is not handled`);
      out += `${indent}${key}: ${value};\n`;
    } else {
      if (Object.keys(value).length === 0) throw new Error(`kumo dev: empty css entry "${key}" is not handled`);
      out += `${indent}${key} {\n${toCss(value, indent + "  ")}${indent}}\n`;
    }
  }
  return out;
}

export function kumoFromRegistry(): Plugin {
  const components = json(resolve(site, "components.json"));
  if (components.iconLibrary !== "lucide") {
    throw new Error(`kumo dev: iconLibrary "${components.iconLibrary}" is not handled, only lucide`);
  }
  // "@/components/ui" in components.json is src/components/ui here ("@" is src).
  const installDir = (alias: string) => resolve(site, "src", alias.replace(/^@\//, ""));
  const targets: Record<string, string> = {
    "@ui": installDir(components.aliases.ui),
    "@lib": installDir(components.aliases.lib),
  };
  const cssFile = resolve(site, components.tailwind.css);

  // The items in kumo-items.txt and everything they depend on.
  const all = new Map<string, Item>((json(registryFile).items as Item[]).map((item) => [item.name, item]));
  const items = new Map<string, Item>();
  const add = (name: string) => {
    const item = all.get(name);
    if (!item) throw new Error(`kumo dev: no item "${name}" in registry.json`);
    if (items.has(name)) return;
    items.set(name, item);
    for (const dependency of item.registryDependencies ?? []) {
      // The registry's own items are URLs ending in /r/<name>.json. Anything
      // else is shadcn's ("utils"), which is set up below.
      const own = /\/r\/([^/]+)\.json$/.exec(dependency);
      if (own) add(own[1]);
    }
  };
  for (const line of readFileSync(itemsFile, "utf8").split("\n")) {
    if (line.trim() && !line.startsWith("#")) add(line.trim());
  }

  // Where the CLI would install each file (without extension) -> its source.
  const sources = new Map<string, string>();
  for (const item of items.values()) {
    for (const file of item.files ?? []) {
      const [prefix, ...rest] = file.target.split("/");
      if (!targets[prefix]) throw new Error(`kumo dev: target "${file.target}" of ${item.name} is not handled`);
      const installed = withoutExtension(resolve(targets[prefix], ...rest));
      sources.set(installed, resolve(repo, file.path));
      if (installed.endsWith("/index")) sources.set(dirname(installed), resolve(repo, file.path));
    }
  }
  // shadcn's "utils" item and the icon placeholder (see registry/shadcn-utils.ts
  // and registry/icon-placeholder.tsx, their stand-ins for type-checking).
  sources.set(installDir(components.aliases.utils), resolve(repo, "registry/shadcn-utils.ts"));
  sources.set(resolve(site, "src/app/(create)/components/icon-placeholder"), ICONS);

  // The CLI writes theme items first, then the rest.
  const ordered = [...items.values()].sort((a, b) => Number(b.type === "registry:theme") - Number(a.type === "registry:theme"));
  let css = "\n/* Added by vite-dev-registry.ts, in place of what `shadcn add` writes here. */\n";
  for (const file of new Set(sources.values())) {
    // Tailwind only scans this app's own files for class names.
    if (file !== ICONS) css += `@source "${relative(dirname(cssFile), file)}";\n`;
  }
  for (const item of ordered) {
    for (const [scope, vars] of Object.entries(item.cssVars ?? {})) {
      if (scope !== "theme") throw new Error(`kumo dev: cssVars.${scope} of ${item.name} is not handled`);
      css += toCss({ "@theme inline": vars });
    }
    css += toCss(item.css ?? {});
  }

  return {
    name: "kumo-from-registry",
    enforce: "pre",
    resolveId(id) {
      // "@/..." reaches this hook already resolved to src/... by the "@" alias.
      const source = sources.get(withoutExtension(id));
      if (source) return source;
      if ([targets["@ui"], resolve(targets["@lib"], "kumo")].some((dir) => id.startsWith(`${dir}/`))) {
        this.error(`${relative(site, id)} is not installed: add its item to kumo-items.txt`);
      }
    },
    load(id) {
      if (id === ICONS) {
        return `
import { createElement } from "react";
import * as icons from "lucide-react";
export function IconPlaceholder({ lucide, tabler, hugeicons, phosphor, remixicon, ...props }) {
  if (!icons[lucide]) throw new Error("lucide-react has no icon " + lucide);
  return createElement(icons[lucide], props);
}`;
      }
      if (id.split("?")[0] === cssFile) return readFileSync(cssFile, "utf8") + css;
    },
    configureServer(server) {
      // The item list and the registry are read once, at startup.
      server.watcher.add([registryFile, itemsFile]);
      server.watcher.on("change", (file) => {
        if (file === registryFile || file === itemsFile) void server.restart();
      });
    },
  };
}
