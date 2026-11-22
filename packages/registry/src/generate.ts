#!/usr/bin/env node
// Generates the kumo-shadcn registry from Kumo's source code.
//
//   node packages/registry/src/generate.ts --kumo <path to a checkout of cloudflare/kumo> [--base-url <url>]
//
// Deterministic: the same Kumo source gives the same output. It parses Kumo's
// files (TypeScript compiler API, PostCSS) and never runs them. It fails on
// anything it does not know how to map: an unmapped icon, an import it cannot
// classify, a dependency Kumo does not declare.
//
// Output: registry/kumo/** (copied, rewritten source), registry.json.
// `shadcn build` then turns registry.json into public/r/*.json.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import postcss, { type AtRule, type ChildNode, type Container, type Rule } from "postcss";
import nested from "postcss-nested";
import ts from "typescript";
import { ICON_LIBRARIES, SHIM_EXTRAS, iconNames } from "./icons.ts";
import { RELATIVE_COLOR_SUPPORTS, binding, kumoCloudflare, kumoTheme, type KumoTheme } from "./themes.ts";
import { BASE_URL, HOMEPAGE, NAMESPACE, SITE } from "./config.ts";

// IconPlaceholder is shadcn's marker element. The CLI removes this import when
// it installs the file; the path only has to contain "icon-placeholder" and
// must not start with @/registry/ (the CLI's alias rewrite would mangle that).
const ICON_PLACEHOLDER_IMPORT = "@/app/(create)/components/icon-placeholder";

const { values: args } = parseArgs({
  options: { kumo: { type: "string" }, "base-url": { type: "string" }, "deps": { type: "string" } },
});
if (!args.kumo) fail("usage: node packages/registry/src/generate.ts --kumo <kumo checkout> [--base-url <url>]");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."); // the repository root
const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), ".."); // packages/registry
const kumoRepo = resolve(args.kumo);
const kumoPkgDir = join(kumoRepo, "packages", "kumo");
const src = join(kumoPkgDir, "src");
const baseUrl = (args["base-url"] ?? BASE_URL).replace(/\/$/, "");
const kumoPkg = JSON.parse(readFileSync(join(kumoPkgDir, "package.json"), "utf8"));
const release = `${kumoPkg.name}@${kumoPkg.version}`;
const outDir = join(root, "registry", "kumo");

function fail(message: string): never {
  console.error(`generate: ${message}`);
  process.exit(1);
}
const posix = (p: string) => p.split("\\").join("/");
const pascal = (s: string) => s.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
const sorted = <T>(items: Iterable<T>) => [...items].sort();
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const itemUrl = (name: string) => `${baseUrl}/${name}.json`;
// The registry's namespace (config.ts): components.json "registries": {"@kumo-shadcn": "<base>/{name}.json"}.
// How items refer to each other in registryDependencies: "url" (full item
// URLs; works with no configuration) or "namespace" (@kumo-shadcn/<item>; needs the
// namespace configured, or listed in the shadcn registry directory).
const depsForm = args.deps ?? "url";
if (!["url", "namespace"].includes(depsForm)) fail(`--deps must be url or namespace`);
// "utils" is shadcn's own item (lib/utils.ts with cn), so it stays a bare name.
const depRef = (name: string) => (name === "utils" ? name : depsForm === "namespace" ? `${NAMESPACE}/${name}` : itemUrl(name));
const depName = (ref: string) =>
  ref.startsWith(`${NAMESPACE}/`) ? ref.slice(NAMESPACE.length + 1) : ref.startsWith(baseUrl) ? ref.slice(baseUrl.length + 1, -5) : ref;

// ---------------------------------------------------------------------------
// Source files

// Areas of Kumo's src/ the registry copies. Everything else (primitives, code,
// catalog, registry, command-line, styles) is out of scope, and an import
// into it fails the build.
type Area = { kind: "ui" | "block" | "lib"; item: string; rel: string };

const SKIP_FILE = /\.(test|spec|stories|type-spec|visual|bench)\.[cm]?tsx?$|\.d\.ts$/;
const SKIP_DIR = new Set(["tests", "__tests__", "__snapshots__", "specs", "stories"]);

function listSource(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR.has(entry.name)) out.push(...listSource(p));
    } else if (/\.tsx?$/.test(entry.name) && !SKIP_FILE.test(entry.name)) out.push(p);
  }
  return out.sort();
}
const subdirs = (dir: string) =>
  readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();

// cn: Kumo's utils/cn.ts only re-exports cn from the `cn` package. The
// registry uses the project's own shadcn cn instead (@/lib/utils, shadcn's
// "utils" item, which leaves an installed cn package alone). What is left of
// that file is safeRandomId, so it is renamed.
const KUMO_CN_FILE = "utils/cn.ts";
const SHADCN_UTILS = "@/lib/utils";
const RENAMED_HELPERS: Record<string, string> = { "cn.ts": "random-id.ts" };
const isKumoCn = (file: string, name: string) => posix(relative(src, file)) === KUMO_CN_FILE && name === "cn";

function areaOf(file: string): Area | undefined {
  const parts = posix(relative(src, file)).split("/");
  if (parts[0] === "components" && parts.length > 2) return { kind: "ui", item: parts[1], rel: parts.slice(2).join("/") };
  if (parts[0] === "blocks" && parts.length > 2) return { kind: "block", item: parts[1], rel: parts.slice(2).join("/") };
  if (parts[0] === "utils" && parts.length > 1) {
    const rel = parts.slice(1).join("/");
    return { kind: "lib", item: "kumo-utils", rel: RENAMED_HELPERS[rel] ?? rel };
  }
  return undefined;
}

const included = new Set(
  [...subdirs(join(src, "components")).map((d) => join(src, "components", d)), ...subdirs(join(src, "blocks")).map((d) => join(src, "blocks", d)), join(src, "utils")]
    .flatMap(listSource),
);

function resolveRelative(from: string, spec: string): string {
  const base = resolve(dirname(from), spec);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  const hit = candidates.find((c) => existsSync(c) && statSync(c).isFile());
  if (!hit) fail(`cannot resolve "${spec}" from ${relative(src, from)}`);
  if (!included.has(hit)) fail(`unknown import pattern: "${spec}" in ${relative(src, from)} points outside components/blocks/utils (${relative(src, hit)})`);
  return hit;
}

// Import path of a copied file in the user's project, before the shadcn CLI
// maps it through components.json. Barrels keep an explicit /index so that a
// flat components/ui/<name>.tsx (shadcn's own button, say) can't shadow it.
function aliasPath(area: Area): string {
  const noExt = area.rel.replace(/\.tsx?$/, "");
  if (area.kind === "ui") return `@/components/ui/${area.item}/${noExt}`;
  if (area.kind === "block") return `@/components/${area.item}/${noExt}`;
  return `@/lib/kumo/${noExt}`;
}
function targetOf(area: Area): string {
  if (area.kind === "ui") return `@ui/${area.item}/${area.rel}`;
  if (area.kind === "block") return `@components/${area.item}/${area.rel}`;
  return `@lib/kumo/${area.rel}`;
}
function outPath(area: Area): string {
  const sub = area.kind === "ui" ? "ui" : area.kind === "block" ? "blocks" : "lib/kumo";
  return posix(join("registry", "kumo", sub, area.kind === "lib" ? "" : area.item, area.rel));
}

// ---------------------------------------------------------------------------
// Source patches: the only changes to Kumo's code besides import paths.
// Each must match exactly once, or generation fails.
const SOURCE_PATCHES: { file: string; find: string; replace: string; why: string }[] = [
  {
    // Kumo's Sidebar sets its colors with arbitrary-property classes on its
    // wrapper, which a stylesheet can't override. This lets a theme item
    // (kumo-cloudflare) set them; unset, they are Kumo's defaults.
    file: "components/sidebar/sidebar.tsx",
    find: "[--sidebar-active-bg:var(--color-kumo-tint)] [--sidebar-bg:var(--color-kumo-base)]",
    replace: "[--sidebar-active-bg:var(--kumo-sidebar-active-bg,var(--kumo-highlight,var(--color-kumo-tint)))] [--sidebar-bg:var(--kumo-sidebar-bg,var(--color-kumo-base))]",
    why: "the sidebar's default colors read --kumo-sidebar-bg and --kumo-sidebar-active-bg (then --kumo-highlight) first",
  },
  // The bevel hook. Kumo draws primary and destructive buttons with a
  // gradient from gradient-start to gradient-end, a 1px inset top line in
  // emphasis-bg, and a hover that moves the gradient's start to emphasis-bg.
  // Four derived variables scale that with --kumo-button-bevel (a number,
  // clamped to 0..1): unset or 1 is Kumo's bevel, 0 is flat (solid token, no
  // line; hover is a solid gradient-start, the token with 15% white). They mix
  // Kumo's own four variables rather than the token, so a component that
  // overrides those (BannerAction) still gets its colors.
  {
    file: "components/button/button.tsx",
    find: '    "--kumo-button-emphasis-gradient-end": token,\n',
    replace: [
      '    "--kumo-button-emphasis-gradient-end": token,',
      '    "--kumo-button-emphasis-from": "color-mix(in oklch, var(--kumo-button-emphasis-gradient-end), var(--kumo-button-emphasis-gradient-start) calc(100% * clamp(0, var(--kumo-button-bevel, 1), 1)))",',
      '    "--kumo-button-emphasis-hover-from": "color-mix(in oklch, var(--kumo-button-emphasis-gradient-start), var(--kumo-button-emphasis-bg) calc(100% * clamp(0, var(--kumo-button-bevel, 1), 1)))",',
      '    "--kumo-button-emphasis-hover-to": "color-mix(in oklch, var(--kumo-button-emphasis-gradient-end), var(--kumo-button-emphasis-gradient-start) calc(100% - 100% * clamp(0, var(--kumo-button-bevel, 1), 1)))",',
      '    "--kumo-button-emphasis-inset": "color-mix(in oklch, var(--kumo-button-emphasis-bg) calc(100% * clamp(0, var(--kumo-button-bevel, 1), 1)), transparent)",',
      "",
    ].join("\n"),
    why: "the emphasis gradient, inset line and hover read --kumo-button-bevel (unset: Kumo's bevel; 0: flat)",
  },
  {
    file: "components/button/button.tsx",
    find: "from-(--kumo-button-emphasis-gradient-start) to-(--kumo-button-emphasis-gradient-end) shadow-[inset_0_1px_0_0_var(--kumo-button-emphasis-bg)] group-hover:from-(--kumo-button-emphasis-bg)",
    replace: "from-(--kumo-button-emphasis-from) to-(--kumo-button-emphasis-gradient-end) shadow-[inset_0_1px_0_0_var(--kumo-button-emphasis-inset)] group-hover:from-(--kumo-button-emphasis-hover-from) group-hover:to-(--kumo-button-emphasis-hover-to)",
    why: "the emphasis gradient, inset line and hover read --kumo-button-bevel (unset: Kumo's bevel; 0: flat)",
  },
];
const appliedPatches = new Set<string>();

// The highlight hook. Interactive-state backgrounds that use Kumo's tint
// (hover, highlighted, selected, open, ...) read --kumo-highlight first, so
// a theme can give every hover/selected background one shade
// (kumo-cloudflare does). Unset, they are Kumo's tint. Only class tokens
// whose variant chain has one of these states and whose utility is exactly
// bg-kumo-tint change; static tint, semantic tints and other tokens don't.
// packages/registry/src/expected-highlights.txt lists every match; a difference fails
// generation, so new occurrences get reviewed.
const HIGHLIGHT_STATES = new Set([
  "hover", "group-hover", "data-highlighted", "data-[highlighted]", "data-active", "data-[active]",
  "aria-selected", "data-selected", "data-[selected]", "data-[state=open]", "data-popup-open", "focus-visible", "active",
]);
const HIGHLIGHT_UTILITY = "bg-(--kumo-highlight,var(--color-kumo-tint))";
const highlightHits: string[] = [];
function variantsOf(prefix: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of prefix) {
    if (ch === "[" || ch === "(") depth++;
    if (ch === "]" || ch === ")") depth--;
    if (ch === ":" && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  return out;
}
function hookHighlights(where: string, text: string): string {
  return text.replace(/(?<=^|[\s"'`])((?:[^\s"'`:]*(?:\[[^\]\s]*\])?[^\s"'`:]*:)+)bg-kumo-tint(?=[\s"'`]|$)/gm, (token, prefix: string, offset: number) => {
    const states = variantsOf(prefix).map((v) => v.replace(/\/.*$/, ""));
    if (!states.some((v) => HIGHLIGHT_STATES.has(v))) return token;
    highlightHits.push(`${where}:${text.slice(0, offset).split("\n").length} ${token}`);
    return `${prefix}${HIGHLIGHT_UTILITY}`;
  });
}

function patchSource(where: string, text: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  const hooked = hookHighlights(where, text);
  if (hooked !== text) notes.push("hover/selected backgrounds that use Kumo's tint read --kumo-highlight first");
  text = hooked;
  for (const p of SOURCE_PATCHES.filter((p) => p.file === where)) {
    const count = text.split(p.find).length - 1;
    if (count !== 1) fail(`source patch for ${where} matched ${count} times (expected 1): ${p.find}`);
    text = text.replace(p.find, p.replace);
    appliedPatches.add(p.find);
    if (p.why && !notes.includes(p.why)) notes.push(p.why);
  }
  return { text, notes };
}

// ---------------------------------------------------------------------------
// Imports

const PHOSPHOR = new Set(["@phosphor-icons/react", "@phosphor-icons/react/dist/ssr"]);
const IGNORED_PACKAGES = new Set(["react", "react-dom"]);
const packageName = (spec: string) => spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/");

interface Copied {
  area: Area;
  code: string;
  dependencies: Set<string>;
  devDependencies: Set<string>;
  registryDependencies: Set<string>;
  localFiles: Set<string>; // other Kumo files this file imports
  usesProcessEnv: boolean;
}
const iconImports = new Set<string>();
const cnRewrites = new Set<string>(); // files whose cn import now comes from @/lib/utils

type Found = { node: ts.StringLiteralLike; decl?: ts.ImportDeclaration; reexport?: ts.ExportDeclaration; sideEffect: boolean };
function moduleSpecifiers(sf: ts.SourceFile): Found[] {
  const found: Found[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push({ node: node.moduleSpecifier, decl: node, sideEffect: !node.importClause });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push({ node: node.moduleSpecifier, reexport: node, sideEffect: false });
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      fail(`unknown import pattern: import = require() in ${sf.fileName}`);
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      const [arg] = node.arguments;
      if (!arg || !ts.isStringLiteralLike(arg)) fail(`unknown import pattern: dynamic import with a computed path in ${sf.fileName}`);
      found.push({ node: arg, sideEffect: false });
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      found.push({ node: node.argument.literal, sideEffect: false });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function dependencyRange(name: string, file: string): string {
  const range = kumoPkg.dependencies?.[name] ?? kumoPkg.peerDependencies?.[name];
  if (!range) fail(`unknown import pattern: "${name}" in ${file} is not a dependency of ${kumoPkg.name}`);
  return `${name}@${range}`;
}
function typesPackage(name: string): string | undefined {
  const types = `@types/${name.startsWith("@") ? name.slice(1).replace("/", "__") : name}`;
  const range = kumoPkg.devDependencies?.[types];
  return range ? `${types}@${range}` : undefined;
}

// Which file defines `name`, following `export ... from` in index files.
// The shadcn CLI shortens ".../button/index" to ".../button" on install,
// which a flat components/ui/button.tsx (shadcn's own) would shadow, so
// imports across items point at the defining file instead of the barrel.
const parsed = new Map<string, ts.SourceFile>();
function parse(file: string): ts.SourceFile {
  let sf = parsed.get(file);
  if (!sf) parsed.set(file, (sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)));
  return sf;
}
const isBarrel = (file: string) => /\/index\.tsx?$/.test(file);
let originName = ""; // the name at the origin, after following renames
function originOf(file: string, name: string, seen = new Set<string>(), followRenames = false): string | undefined {
  if (seen.has(file)) return undefined;
  seen.add(file);
  originName = name;
  if (!isBarrel(file)) return file;
  for (const st of parse(file).statements) {
    if (!ts.isExportDeclaration(st) || !st.moduleSpecifier || !ts.isStringLiteral(st.moduleSpecifier)) {
      // Something defined in the barrel itself (Kumo has a few type aliases).
      if (ts.canHaveModifiers(st) && ts.getModifiers(st)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const declared = (st as { name?: ts.Identifier }).name?.text;
        if (declared === name) return file;
      }
      continue;
    }
    const target = st.moduleSpecifier.text.startsWith(".") ? resolveRelative(file, st.moduleSpecifier.text) : undefined;
    if (!st.exportClause) {
      if (target) {
        const hit = originOf(target, name, seen, followRenames);
        if (hit) return hit;
      }
      continue;
    }
    if (!ts.isNamedExports(st.exportClause)) continue;
    const el = st.exportClause.elements.find((e) => e.name.text === name);
    if (!el) continue;
    if (!target) fail(`unknown import pattern: ${relative(src, file)} re-exports ${name} from a package`);
    if (el.propertyName && el.propertyName.text !== name) {
      if (!followRenames) fail(`unknown import pattern: ${relative(src, file)} renames ${el.propertyName.text} to ${name}`);
      return originOf(target, el.propertyName.text, new Set(), true);
    }
    return originOf(target, name, new Set(), followRenames) ?? fail(`cannot find where ${name} is defined (from ${relative(src, file)})`);
  }
  return undefined;
}

function copyFile(file: string): Copied {
  const area = areaOf(file)!;
  const where = posix(relative(src, file));
  const patched = patchSource(where, readFileSync(file, "utf8"));
  const text = patched.text;
  const sf = ts.createSourceFile(where, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const copied: Copied = { area, code: "", dependencies: new Set(), devDependencies: new Set(), registryDependencies: new Set(), localFiles: new Set(), usesProcessEnv: false };
  const edits: { start: number; end: number; text: string }[] = [];
  const replaceSpec = (node: ts.StringLiteralLike, spec: string) =>
    edits.push({ start: node.getStart(sf) + 1, end: node.getEnd() - 1, text: spec });

  for (const { node, decl, reexport, sideEffect } of moduleSpecifiers(sf)) {
    const spec = node.text;
    if (sideEffect && !spec.startsWith(".")) fail(`unknown import pattern: side-effect import "${spec}" in ${where}`);
    if (spec.startsWith(".")) {
      const target = resolveRelative(file, spec);
      const targetArea = areaOf(target)!;
      copied.localFiles.add(target);
      const sameItem = targetArea.kind === area.kind && targetArea.item === area.item;
      const helpers = targetArea.kind === "lib";
      if (sameItem && !helpers) continue; // same component: keep relative
      if (!isBarrel(target) && !helpers) {
        copied.registryDependencies.add(targetArea.item);
        replaceSpec(node, aliasPath(targetArea));
        continue;
      }
      // A barrel, or Kumo's helpers: group the names by defining file. A
      // name defined in Kumo's utils/cn.ts named cn comes from the project's
      // shadcn utils instead; re-exports of it from the helpers are dropped.
      const owner = decl ?? reexport;
      const clause = decl ? decl.importClause?.namedBindings : reexport?.exportClause;
      if (!owner || !clause || (decl?.importClause?.name) || !(ts.isNamedImports(clause) || ts.isNamedExports(clause)))
        fail(`unknown import pattern: only named imports from another item's index or Kumo's helpers are supported (${where}: "${spec}")`);
      const groups = new Map<string, string[]>();
      for (const el of clause.elements as ts.NodeArray<ts.ImportSpecifier | ts.ExportSpecifier>) {
        const name = (el.propertyName ?? el.name).text;
        const origin = originOf(target, name) ?? fail(`cannot find where ${name} is defined (imported in ${where} from "${spec}")`);
        let key: string;
        if (isKumoCn(origin, name)) {
          if (reexport && area.kind === "lib") continue; // the helpers no longer re-export cn
          if (reexport) fail(`unknown import pattern: ${where} re-exports cn`);
          key = SHADCN_UTILS;
          copied.registryDependencies.add("utils");
          cnRewrites.add(where);
        } else {
          copied.localFiles.add(origin);
          const originArea = areaOf(origin)!;
          if (originArea.kind === area.kind && originArea.item === area.item)
            key = `./${posix(relative(dirname(outPath(area)), outPath(originArea))).replace(/\.tsx?$/, "")}`.replace(/^\.\/\.\.\//, "../");
          else {
            key = aliasPath(originArea);
            copied.registryDependencies.add(originArea.item);
          }
        }
        groups.set(key, [...(groups.get(key) ?? []), el.getText(sf)]);
      }
      const kw = decl ? "import" : "export";
      const typeOnly = (decl ? decl.importClause?.isTypeOnly : reexport?.isTypeOnly) ? " type" : "";
      const text = [...groups].map(([path, names]) => `${kw}${typeOnly} { ${names.join(", ")} } from "${path}";`).join("\n");
      edits.push({ start: owner.getStart(sf), end: owner.getEnd(), text });
    } else if (PHOSPHOR.has(spec)) {
      const bindings = decl?.importClause;
      if (!decl || !bindings || bindings.name || !bindings.namedBindings || !ts.isNamedImports(bindings.namedBindings))
        fail(`unknown import pattern: only named imports from ${spec} are supported (${where})`);
      for (const el of bindings.namedBindings.elements) {
        const name = (el.propertyName ?? el.name).text;
        if (!SHIM_EXTRAS.has(name) && !iconNames(name.replace(/(.)Icon$/, "$1"))) fail(`unmapped icon: ${name} (imported in ${where})`);
        iconImports.add(name);
      }
      replaceSpec(node, "@/lib/kumo/icons");
      copied.registryDependencies.add("kumo-icons");
    } else if (spec.startsWith("@phosphor-icons/")) {
      fail(`unknown import pattern: "${spec}" in ${where}`);
    } else if (packageName(spec) === "@cloudflare/kumo") {
      fail(`unknown import pattern: ${where} imports "${spec}" (the registry must not depend on the npm package)`);
    } else if (spec === "cn") {
      // Kumo's utils/cn.ts re-exports the cn package; the registry uses the
      // project's shadcn cn, so that statement goes.
      if (!(reexport && area.kind === "lib")) fail(`unknown import pattern: ${where} imports the cn package directly`);
      edits.push({ start: reexport.getFullStart(), end: reexport.getEnd(), text: "" });
    } else {
      const name = packageName(spec);
      if (IGNORED_PACKAGES.has(name)) {
        continue;
      }
      copied.dependencies.add(dependencyRange(name, where));
      const types = typesPackage(name);
      if (types) copied.devDependencies.add(types);
    }
  }

  // Kumo prints development warnings behind process.env.NODE_ENV. Bundlers
  // replace it; kumo-utils ships its type for apps without @types/node.
  const findProcessEnv = (node: ts.Node): boolean =>
    (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "process") || ts.forEachChild(node, findProcessEnv) === true;
  if (findProcessEnv(sf)) {
    copied.usesProcessEnv = true;
    if (area.kind !== "lib") copied.registryDependencies.add("kumo-utils");
  }

  if (cnRewrites.has(where)) patched.notes.push("cn comes from your shadcn utils (@/lib/utils)");
  if (where === KUMO_CN_FILE) patched.notes.push("cn is no longer re-exported (it comes from your shadcn utils), and the file is renamed random-id.ts");
  if (where === "utils/index.ts") patched.notes.push("cn is no longer re-exported (it comes from your shadcn utils)");
  let body = text;
  for (const e of edits.sort((a, b) => b.start - a.start)) body = body.slice(0, e.start) + e.text + body.slice(e.end);
  // "use client" stays exactly where Kumo's source has it. The license header
  // goes right after the first statement (the directive, or usually the
  // first import): the shadcn CLI strips comments before a file's first
  // statement when it installs it, but keeps comments after it.
  // (the first statement that the edits above didn't remove)
  const removed = (st: ts.Statement) => edits.some((e) => e.text === "" && e.start <= st.getFullStart() && e.end >= st.getEnd());
  const first = sf.statements.find((st) => !removed(st));
  if (!first) fail(`${where} has no statements left`);
  const shift = edits.filter((e) => e.end <= first.getEnd()).reduce((n, e) => n + e.text.length - (e.end - e.start), 0);
  const at = first.getEnd() + shift;
  copied.code = `${body.slice(0, at).replace(/^\s+/, "")}\n\n${sourceHeader(where, patched.notes)}\n${body.slice(at).replace(/^[ \t]*\n/, "")}`;
  return copied;
}

// ---------------------------------------------------------------------------
// License header

const licenseText = readFileSync(join(kumoRepo, "LICENSE"), "utf8").trim();
const licenseComment = licenseText.split("\n").map((l) => (l.trim() ? `// ${l.trimEnd()}` : "//")).join("\n");
function sourceHeader(where: string, notes: string[]): string {
  return [
    `// Kumo, packages/kumo/src/${where} from https://github.com/cloudflare/kumo`,
    `// (release ${release.replace("@", "")}), copied by the kumo-shadcn registry (${HOMEPAGE}).`,
    "// Changes from Kumo's file: import paths.",
    ...notes.map((n) => `// Also changed: ${n}.`),
    "// Unofficial; not affiliated with or endorsed by Cloudflare.",
    "//",
    licenseComment,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Icon shim

function iconShim(): string {
  const used = sorted(iconImports);
  const icons = new Map<string, string[]>(); // base name -> exported names
  for (const name of used) {
    if (SHIM_EXTRAS.has(name)) continue;
    const base = name.replace(/(.)Icon$/, "$1");
    icons.set(base, [...(icons.get(base) ?? []), name]);
  }
  const components: string[] = [];
  const exports: string[] = [];
  for (const [base, names] of [...icons].sort(([a], [b]) => cmp(a, b))) {
    const lib = iconNames(base)!;
    const attrs = ICON_LIBRARIES.map((l) => `${l}="${lib[l]}"`).join(" ");
    components.push(`function Kumo_${base}(props: IconProps) {\n  return <IconPlaceholder ${attrs} {...useIconProps(props)} />;\n}`);
    exports.push(...names.map((n) => `Kumo_${base} as ${n}`));
  }
  for (const extra of used.filter((n) => SHIM_EXTRAS.has(n))) if (!["Icon", "IconProps", "IconWeight", "IconContext"].includes(extra)) fail(`shim has no ${extra}`);
  return `"use client";

// Icon shim for Kumo components, generated by the kumo-shadcn registry (${HOMEPAGE}).
// MIT License, copyright (c) 2026 Thomas Ricci. Not copied from Kumo.
//
// Kumo's components import these names from @phosphor-icons/react. Here each
// one renders shadcn's IconPlaceholder, which the shadcn CLI replaced with the
// icon from the library set in your components.json when it wrote this file.
// Phosphor-only props are mapped: size (default 1em, like Phosphor), weight
// (to a stroke width), mirrored (to a CSS flip) and IconContext defaults.

import * as React from "react";
import { IconPlaceholder } from "${ICON_PLACEHOLDER_IMPORT}";

export type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, "ref" | "children"> {
  size?: number | string;
  weight?: IconWeight;
  color?: string;
  mirrored?: boolean;
  alt?: string;
}

/** Any icon component: a Kumo shim icon, or one from your icon library. */
export type Icon = React.ComponentType<IconProps>;

/** Default props for the icons inside it, like Phosphor's IconContext. */
export const IconContext = React.createContext<IconProps>({});

const STROKE_WIDTH: Record<IconWeight, number> = { thin: 1, light: 1.5, regular: 2, bold: 2.5, fill: 2, duotone: 2 };

// What reaches the library's icon component. Every key is optional, so the
// default props the CLI writes (hugeicons: strokeWidth={2}) can come first.
type LibraryIconProps = Omit<IconProps, "weight" | "mirrored" | "alt" | "strokeWidth"> & { strokeWidth?: number };

function useIconProps({ size, weight, color, mirrored, alt, style, strokeWidth, ...rest }: IconProps): LibraryIconProps {
  const defaults = React.useContext(IconContext);
  const flip = mirrored ?? defaults.mirrored;
  return {
    size: size ?? defaults.size ?? "1em",
    color: color ?? defaults.color ?? "currentColor",
    strokeWidth: strokeWidth !== undefined ? Number(strokeWidth) : STROKE_WIDTH[weight ?? defaults.weight ?? "regular"],
    ...(alt ? { role: "img", "aria-label": alt } : {}),
    style: flip ? { transform: "scaleX(-1)", ...style } : style,
    ...rest,
  };
}

${components.join("\n\n")}

export {
${exports.map((e) => `  ${e},`).join("\n")}
};
`;
}

// ---------------------------------------------------------------------------
// CSS: Kumo's stylesheets -> shadcn `css` / `cssVars` objects

type CssObject = { [key: string]: string | CssObject };
const KUMO_TOKEN = /^--(color|text-color)-kumo-(.+)$/;
const NOT_TOKEN = /^--color-kumo-neutral-/; // primitives, not theme tokens
// Kumo token -> the plain variable a theme sets.
function tokenVar(prop: string): string {
  const m = prop.match(KUMO_TOKEN)!;
  return m[1] === "color" ? `--kumo-${m[2]}` : `--kumo-text-${m[2]}`;
}
const isToken = (prop: string) => KUMO_TOKEN.test(prop) && !NOT_TOKEN.test(prop);
const DARK = '[data-mode="dark"]';

// Kumo marks dark mode with data-mode="dark"; shadcn uses a .dark class.
// Every selector that mentions Kumo's dark marker gets a .dark twin.
function withDarkTwins(selector: string): string {
  const parts = postcss.list.comma(selector).map((s) => s.replace(/\s+/g, " ").trim());
  const twins = parts.filter((s) => s.includes(DARK)).map((s) => s.split(DARK).join(".dark"));
  return [...new Set([...parts, ...twins])].join(", ");
}

function parseCss(file: string) {
  const css = readFileSync(file, "utf8");
  const result = postcss([nested]).process(css, { from: file });
  return result.root;
}

function declsOf(container: Container, onDecl?: (prop: string, value: string) => string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of container.nodes ?? []) {
    if (node.type === "decl") {
      const value = `${node.value}${node.important ? " !important" : ""}`;
      const mapped = onDecl ? onDecl(node.prop, value) : value;
      if (mapped !== undefined) out[node.prop] = mapped;
    } else if (node.type !== "comment") fail(`unexpected ${node.type} inside a rule in Kumo's CSS (${node.source?.input.file})`);
  }
  return out;
}

function merge(into: CssObject, key: string, value: CssObject) {
  const existing = into[key];
  if (existing && typeof existing === "object") Object.assign(existing, value);
  else into[key] = value;
}

// Converts nodes to the CLI's `css` shape. Top-level @keyframes go inside
// @layer base: the CLI would put them in @theme inline, where Tailwind drops
// keyframes that no --animate-* variable uses.
function cssObject(nodes: ChildNode[], into: CssObject, ctx: { top: boolean; theme: Record<string, string> }) {
  for (const node of nodes) {
    if (node.type === "comment") continue;
    if (node.type === "decl") fail(`unexpected top-level declaration ${node.prop} in Kumo's CSS`);
    if (node.type === "rule") {
      merge(into, withDarkTwins(node.selector), declsOf(node));
      continue;
    }
    const at = node as AtRule;
    if (at.name === "import" || at.name === "source") continue;
    if (at.name === "theme") {
      Object.assign(ctx.theme, declsOf(at));
      continue;
    }
    if (at.name === "keyframes") {
      const frames: CssObject = {};
      for (const frame of at.nodes ?? []) if (frame.type === "rule") merge(frames, frame.selector.replace(/\s+/g, " "), declsOf(frame));
      // A later @keyframes with the same name replaces the earlier one.
      const parent = ctx.top ? ((into["@layer base"] ??= {}) as CssObject) : into;
      parent[`@keyframes ${at.params}`] = frames;
      continue;
    }
    if (at.name === "property") {
      into[`@property ${at.params}`] = declsOf(at);
      continue;
    }
    if (["layer", "media", "supports"].includes(at.name)) {
      const child = (into[`@${at.name} ${at.params}`] ??= {}) as CssObject;
      cssObject(at.nodes ?? [], child, { ...ctx, top: false });
      continue;
    }
    fail(`unknown CSS at-rule @${at.name} in Kumo's CSS`);
  }
}

// kumo-base: Kumo's non-theme CSS (kumo.css + kumo-binding.css without the
// theme files), and the Tailwind registration of every Kumo token.
function baseCss(tokenNames: string[]) {
  const theme: Record<string, string> = {};
  const css: CssObject = {};
  for (const file of ["kumo-binding.css", "kumo.css"]) {
    const rootNode = parseCss(join(src, "styles", file));
    for (const at of rootNode.nodes) {
      if (at.type === "atrule" && at.name === "import" && !/^["']\.\/(kumo-binding|theme-[a-z]+)\.css["']$/.test(at.params))
        fail(`unknown CSS import ${at.params} in ${file}`);
    }
    cssObject(rootNode.nodes, css, { top: true, theme });
  }
  for (const prop of Object.keys(theme)) if (isToken(prop)) fail(`token ${prop} defined outside the theme files`);
  // Kumo's color primitives (--color-kumo-neutral-*, --color-red-650, ...)
  // are only read through var() by the theme values. They become plain
  // variables: as cssVars.theme colors the CLI would add junk
  // --color-color-* entries next to them.
  const primitives: Record<string, string> = {};
  for (const [prop, value] of Object.entries(theme)) {
    if (!prop.startsWith("--color-")) continue;
    primitives[prop] = value;
    delete theme[prop];
  }
  const custom = Object.keys(primitives).map((p) => p.slice(8)).filter((n) => n.startsWith("kumo-") || !/-(50|[1-9]00|950)$/.test(n));
  const asUtility = new RegExp(`[a-z]-(${custom.join("|")})(?![\\w-])`);
  for (const c of copies.values()) {
    const hit = c.code.replace(/var\(--color-[\w-]+/g, "").match(asUtility);
    if (hit) fail(`${outPath(c.area)} uses the color primitive "${hit[1]}" as a utility class; kumo-base only defines it as a variable`);
  }
  merge(((css["@layer base"] ??= {}) as CssObject), ":root", primitives);
  // Tailwind utilities (bg-kumo-base, text-kumo-subtle, ...) read the plain
  // variables; the @theme inline block below tells Tailwind they exist.
  for (const prop of tokenNames) theme[prop] = `var(${tokenVar(prop)})`;
  // Kumo's source also uses var(--color-kumo-*) directly. Re-derive those on
  // every element that can switch theme or mode, so they follow subtrees too.
  const scope = ':root, .dark, [data-mode], [data-theme]';
  merge(((css["@layer base"] ??= {}) as CssObject), scope, Object.fromEntries(tokenNames.map((p) => [p, `var(${tokenVar(p)})`])));
  return { theme, css };
}

interface TokenBlock { selector: string; vars: Record<string, string> }
// Kumo's theme files: @layer base blocks with explicit values per selector.
function kumoThemeBlocks(file: string): TokenBlock[] {
  const rootNode = parseCss(join(src, "styles", file));
  const blocks: TokenBlock[] = [];
  rootNode.walkAtRules("layer", (layer) => {
    for (const rule of layer.nodes ?? []) {
      if (rule.type !== "rule") continue;
      const vars = declsOf(rule as Rule, (prop, value) => {
        if (!isToken(prop)) fail(`unexpected ${prop} in ${file}`);
        return value;
      });
      const existing = blocks.find((b) => b.selector === withDarkTwins((rule as Rule).selector));
      if (existing) Object.assign(existing.vars, vars);
      else blocks.push({ selector: withDarkTwins((rule as Rule).selector), vars });
    }
  });
  return blocks;
}

function themeCss(blocks: TokenBlock[]): CssObject {
  const layer: CssObject = {};
  for (const b of blocks) {
    const vars = Object.fromEntries(Object.entries(b.vars).map(([p, v]) => [p.startsWith("--kumo") || !isToken(p) ? p : tokenVar(p), v]));
    merge(layer, b.selector, vars);
  }
  return layer;
}

// ---------------------------------------------------------------------------
// The generated tree must type-check cleanly under tsconfig.json: strict,
// isolatedModules (Next.js requires it), bundler resolution. Stricter app
// settings that Kumo's own code doesn't meet (erasableSyntaxOnly,
// noUnusedLocals/Parameters, verbatimModuleSyntax) are left to fail in the
// app, as they would with any shadcn component; packages/verify/verify.sh asserts
// exactly which errors a stock template reports. Nothing is suppressed.
function typeCheck(files: string[]) {
  const config = ts.parseJsonConfigFileContent(ts.readConfigFile(join(pkgDir, "tsconfig.registry.json"), ts.sys.readFile).config, ts.sys, pkgDir);
  const program = ts.createProgram(files, { ...config.options, noEmit: true });
  return [...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics(), ...program.getGlobalDiagnostics()];
}
const formatDiagnostic = (d: ts.Diagnostic) =>
  `${d.file ? `${relative(root, d.file.fileName)}(${d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1}): ` : ""}TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;

// ---------------------------------------------------------------------------
// Build

rmSync(outDir, { recursive: true, force: true });
rmSync(join(root, "public", "r"), { recursive: true, force: true });

const copies = new Map<string, Copied>();
const pending = [...included].filter((f) => areaOf(f)!.kind !== "lib");
const libFiles = new Set<string>();
while (pending.length) {
  const file = pending.pop()!;
  if (copies.has(file)) continue;
  const copied = copyFile(file);
  copies.set(file, copied);
  for (const dep of copied.localFiles) {
    if (areaOf(dep)!.kind === "lib") libFiles.add(dep);
    pending.push(dep);
  }
}

for (const p of SOURCE_PATCHES) if (!appliedPatches.has(p.find)) fail(`source patch target ${p.file} not found`);
{
  const expectedFile = join(pkgDir, "src", "expected-highlights.txt");
  const expected = readFileSync(expectedFile, "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const found = sorted(highlightHits);
  console.log(`Highlight hook on ${found.length} interactive tint backgrounds:\n${found.map((h) => `  ${h}`).join("\n")}`);
  const strip = (l: string) => l.replace(/:\d+ /, " "); // compare without line numbers
  const [want, got] = [sorted(expected.map(strip)), sorted(found.map(strip))];
  if (want.join("\n") !== got.join("\n"))
    fail(`highlight hook matches differ from packages/registry/src/expected-highlights.txt. Review them, then update the file.\n  new: ${got.filter((g) => !want.includes(g)).join(", ") || "-"}\n  gone: ${want.filter((w) => !got.includes(w)).join(", ") || "-"}`);
}
for (const c of copies.values()) {
  const out = join(root, outPath(c.area));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, c.code);
}
const shimPath = "registry/kumo/lib/kumo/icons.tsx";
const processEnvPath = "registry/kumo/lib/kumo/process-env.d.ts";
const needsProcessEnv = [...copies.values()].some((c) => c.usesProcessEnv);
if (needsProcessEnv)
  writeFileSync(
    join(root, processEnvPath),
    `declare namespace NodeJS {
  // Written by the kumo-shadcn registry (${HOMEPAGE}).
  // Kumo's components read process.env.NODE_ENV to print development
  // warnings, and bundlers replace it at build time. This gives it a type in
  // apps without @types/node (Vite's default tsconfig). With @types/node
  // installed, these declarations merge with Node's own.
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
  interface Process {
    env: ProcessEnv;
  }
}
declare var process: NodeJS.Process;
`,
  );
writeFileSync(join(root, shimPath), iconShim());

const generatedFiles = [...copies.values()].map((c) => join(root, outPath(c.area)));
const extraFiles = [join(root, shimPath), ...(needsProcessEnv ? [join(root, processEnvPath)] : [])];
const typeErrors = typeCheck([...generatedFiles, ...extraFiles]);
if (typeErrors.length) fail(`type errors in the generated registry:\n${typeErrors.map(formatDiagnostic).join("\n")}`);

// Tokens and themes
const lightKumo = kumoThemeBlocks("theme-kumo.css");
const fedramp = kumoThemeBlocks("theme-fedramp.css");
const rootLight = lightKumo.find((b) => postcss.list.comma(b.selector).includes(":root"));
const rootDark = lightKumo.find((b) => postcss.list.comma(b.selector).includes(':root[data-mode="dark"]'));
if (!rootLight || !rootDark) fail("theme-kumo.css: no :root or :root[data-mode=\"dark\"] block");
const tokenNames = sorted(new Set([...Object.keys(rootLight.vars), ...Object.keys(rootDark.vars)]));
// Typography and other non-color @theme values of Kumo's theme.
const kumoThemeVars: Record<string, string> = {};
parseCss(join(src, "styles", "theme-kumo.css")).walkAtRules("theme", (at) => {
  Object.assign(kumoThemeVars, declsOf(at, (p, v) => (isToken(p) ? undefined : v)));
});

const base = baseCss(tokenNames);

function bindingBlocks(): { css: CssObject; fallbacks: string[] } {
  const fallbacks: string[] = [];
  const resolveKumo = (value: string, mode: "light" | "dark") =>
    value.replace(/\{kumo:([a-z0-9-]+)\}/g, (_, token: string) => {
      const v = (mode === "light" ? rootLight! : rootDark!).vars[`--${token}`];
      if (!v) fail(`themes.ts refers to unknown Kumo token ${token}`);
      return v;
    });
  const modeVars = (mode: "light" | "dark", tokens: Record<string, string>, all: boolean) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(binding.extras[mode])) if (all) out[k] = resolveKumo(v, mode);
    for (const prop of tokenNames) {
      const key = prop.slice(2);
      if (key in tokens) out[tokenVar(prop)] = resolveKumo(tokens[key], mode);
      else if (all) {
        out[tokenVar(prop)] = (mode === "light" ? rootLight! : rootDark!).vars[prop];
        if (!binding.keepKumo.includes(key)) fallbacks.push(`${mode} ${key}`);
      }
    }
    for (const key of [...Object.keys(tokens), ...binding.keepKumo]) if (!tokenNames.includes(`--${key}`)) fail(`themes.ts names ${key}, which Kumo no longer has`);
    return out;
  };
  const layer: CssObject = { ":root": modeVars("light", binding.tokens.light, true), ".dark": modeVars("dark", binding.tokens.dark, true) };
  layer[`@supports ${RELATIVE_COLOR_SUPPORTS}`] = {
    ":root": modeVars("light", binding.supportsTokens.light, false),
    ".dark": modeVars("dark", binding.supportsTokens.dark, false),
  };
  return { css: { "@layer base": layer }, fallbacks };
}
const bound = bindingBlocks();

// Items
const docsOneTheme = `Use one Kumo theme item at a time. To switch, delete the previous theme's rules from @layer base in your CSS file, then add the new one. See ${HOMEPAGE}#themes`;
const items: Record<string, unknown>[] = [];
const docsTheme = `Kumo components need exactly one theme item: kumo-theme (Kumo's own look), kumo-cloudflare (Kumo with the Cloudflare dashboard's sidebar) or kumo-binding (follows your shadcn theme). See ${HOMEPAGE}#themes`;
items.push({
  name: "kumo-base",
  type: "registry:item",
  title: "Kumo base styles",
  description: `Kumo's keyframes, helper classes and Tailwind token registration (from ${release}). Every Kumo component installs it. Add a theme item too.`,
  cssVars: { theme: base.theme },
  css: base.css,
  docs: docsTheme,
});
// kumo-theme and kumo-cloudflare: Kumo's token blocks, plus a theme's extra
// variables on the :root and dark blocks.
function kumoThemeItem(theme: KumoTheme) {
  const blocks = [...lightKumo, ...fedramp].map((b) => ({
    selector: b.selector,
    vars: { ...b.vars, ...(b === rootLight ? theme.extras.light : b === rootDark ? theme.extras.dark : {}) },
  }));
  return {
    name: theme.name,
    type: "registry:theme",
    title: theme.title,
    description: `${theme.description} From ${release}.`,
    registryDependencies: [depRef("kumo-base")],
    cssVars: { theme: kumoThemeVars },
    css: { "@layer base": themeCss(blocks) },
    docs: docsOneTheme,
  };
}
items.push(kumoThemeItem(kumoTheme), kumoThemeItem(kumoCloudflare));
items.push({
  name: binding.name,
  type: "registry:theme",
  title: binding.title,
  description: binding.description,
  registryDependencies: [depRef("kumo-base")],
  css: bound.css,
  docs: docsOneTheme,
});

const groups = new Map<string, Copied[]>();
for (const c of copies.values()) groups.set(c.area.item, [...(groups.get(c.area.item) ?? []), c]);
const libCopies = [...libFiles].map((f) => copies.get(f)!);
const union = (cs: Copied[], key: "dependencies" | "devDependencies" | "registryDependencies") =>
  sorted(new Set(cs.flatMap((c) => [...c[key]])));
const fileEntry = (c: Copied, type: string) => ({ path: outPath(c.area), type, target: targetOf(c.area) });
const byPath = (a: Copied, b: Copied) => cmp(outPath(a.area), outPath(b.area));

items.push({
  name: "kumo-utils",
  type: "registry:lib",
  title: "Kumo utilities",
  description: `Kumo's shared helpers (cn, variants, link/locale/portal providers, ...) from ${release}.`,
  dependencies: union(libCopies, "dependencies"),
  devDependencies: union(libCopies, "devDependencies"),
  files: [
    ...libCopies.sort(byPath).map((c) => fileEntry(c, "registry:lib")),
    ...(needsProcessEnv ? [{ path: processEnvPath, type: "registry:lib", target: "@lib/kumo/process-env.d.ts" }] : []),
  ],
});
items.push({
  name: "kumo-icons",
  type: "registry:lib",
  title: "Kumo icon shim",
  description: "The Phosphor icons Kumo uses, drawn with the icon library from your components.json (lucide, tabler, hugeicons, phosphor or remixicon).",
  files: [{ path: shimPath, type: "registry:lib", target: "@lib/kumo/icons.tsx" }],
  docs: "The shadcn CLI picks the icons from iconLibrary in components.json. Set it before adding Kumo components.",
});

const exported = new Set(Object.keys(kumoPkg.exports ?? {}).filter((k) => k.startsWith("./components/")).map((k) => k.slice(13)));

// Kumo's own component metadata (ai/component-registry.json in the npm
// package of the same version; packages/registry/src/fetch-kumo.sh puts it in .npm-ai/).
// An entry belongs to the item whose source defines the exported name; an
// item's primary entry is the one whose kebab-cased name is the item name,
// or its only entry. Items without one keep generic text.
type KumoMeta = { name: string; type: string; description?: string; category?: string };
const kumoMetaFile = join(kumoRepo, ".npm-ai", "component-registry.json");
if (!existsSync(kumoMetaFile)) fail(`missing ${relative(root, kumoMetaFile)} (run packages/registry/src/fetch-kumo.sh)`);
const kumoMeta = JSON.parse(readFileSync(kumoMetaFile, "utf8")) as { components: Record<string, KumoMeta>; blocks: Record<string, KumoMeta> };
const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const metaByItem = new Map<string, KumoMeta[]>();
for (const entry of [...Object.values(kumoMeta.components), ...Object.values(kumoMeta.blocks)].sort((a, b) => cmp(a.name, b.name))) {
  for (const [item, cs] of groups) {
    const barrel = cs.find((c) => /^index\.tsx?$/.test(c.area.rel));
    if (!barrel || barrel.area.kind === "lib") continue;
    const origin = originOf(join(src, barrel.area.kind === "ui" ? "components" : "blocks", item, barrel.area.rel), entry.name, new Set(), true);
    if (origin && areaOf(origin)?.item === item && declaresExport(origin, originName)) metaByItem.set(item, [...(metaByItem.get(item) ?? []), entry]);
  }
}
function declaresExport(file: string, name: string): boolean {
  for (const st of parse(file).statements) {
    if (ts.isExportDeclaration(st) && !st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause) && st.exportClause.elements.some((e) => e.name.text === name)) return true;
    if (!ts.canHaveModifiers(st) || !ts.getModifiers(st)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isVariableStatement(st) && st.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === name)) return true;
    if ((st as { name?: ts.Identifier }).name?.text === name) return true;
  }
  return false;
}
const primaryMeta = (item: string) => {
  const entries = metaByItem.get(item) ?? [];
  return entries.find((e) => kebab(e.name) === item) ?? (entries.length === 1 ? entries[0] : undefined);
};
const titleOf = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
for (const [name, cs] of [...groups].sort(([a], [b]) => cmp(a, b))) {
  if (name === "kumo-utils") continue;
  const kind = cs[0].area.kind;
  if (kind === "ui" && !exported.has(name)) console.warn(`note: components/${name} has no ./components/${name} entry in Kumo's package.json`);
  const regDeps = union(cs, "registryDependencies").filter((d) => d !== name);
  const meta = primaryMeta(name);
  const entries = metaByItem.get(name) ?? [];
  items.push({
    name,
    type: kind === "ui" ? "registry:ui" : "registry:block",
    title: meta ? titleOf(meta.name) : pascal(name),
    description: meta?.description
      ? `${meta.description.replace(/\.?$/, ".")} Kumo ${kind === "ui" ? "component" : "block"}, from ${release}.`
      : `Kumo ${pascal(name)} ${kind === "ui" ? "component" : "block"}, from ${release}.`,
    ...(meta?.category ? { categories: [kebab(meta.category.replace(/\s+/g, ""))] } : {}),
    meta: {
      kumo: {
        release: kumoPkg.version,
        source: `packages/kumo/src/${kind === "ui" ? "components" : "blocks"}/${name}`,
        ...(entries.length ? { components: entries.map((e) => e.name) } : {}),
      },
    },
    dependencies: union(cs, "dependencies"),
    devDependencies: union(cs, "devDependencies"),
    registryDependencies: sorted(new Set(["kumo-base", ...regDeps])).map(depRef),
    files: cs.sort(byPath).map((c) => fileEntry(c, kind === "ui" ? "registry:ui" : "registry:component")),
  });
}
for (const item of items) for (const key of ["dependencies", "devDependencies", "registryDependencies"]) if (Array.isArray(item[key]) && !(item[key] as unknown[]).length) delete item[key];

// Every alias import in an item's files must point at a file that the item
// or its registryDependencies (transitively) install, so that adding one
// item on its own works.
{
  const fileOwner = new Map<string, string>();
  for (const it of items as { name: string; files?: { target: string }[] }[])
    for (const f of it.files ?? []) {
      const m = f.target.match(/^@(ui|components|lib)\/(.+)\.(d\.ts|tsx?)$/)!;
      const path = m[1] === "ui" ? `@/components/ui/${m[2]}` : m[1] === "components" ? `@/components/${m[2]}` : `@/lib/${m[2]}`;
      fileOwner.set(path, it.name);
      if (path.endsWith("/index")) fileOwner.set(path.slice(0, -6), it.name);
    }
  fileOwner.set(SHADCN_UTILS, "utils"); // shadcn's own utils item
  const byName = new Map((items as { name: string; registryDependencies?: string[] }[]).map((i) => [i.name, i]));
  const closure = (name: string, seen = new Set<string>()): Set<string> => {
    if (seen.has(name)) return seen;
    seen.add(name);
    for (const url of byName.get(name)?.registryDependencies ?? []) closure(depName(url), seen);
    return seen;
  };
  for (const it of items as { name: string; files?: { path: string }[] }[]) {
    const reach = closure(it.name);
    for (const f of it.files ?? [])
      for (const m of readFileSync(join(root, f.path), "utf8").matchAll(/from "(@\/(?:components|lib)\/[^"]+)"/g)) {
        const owner = fileOwner.get(m[1]);
        if (!owner) fail(`${f.path} imports ${m[1]}, which no item installs`);
        if (!reach.has(owner)) fail(`${f.path} imports ${m[1]} from ${owner}, which ${it.name} does not depend on`);
      }
  }
}

writeFileSync(
  join(root, "registry.json"),
  `${JSON.stringify({ $schema: "https://ui.shadcn.com/schema/registry.json", name: NAMESPACE.slice(1), homepage: SITE, items }, null, 2)}\n`,
);
writeFileSync(join(root, "registry", "kumo", "VERSION"), `${release}\n`);
// Kumo's license, next to the files copied from it (each also has it inline).
writeFileSync(join(root, "registry", "kumo", "LICENSE-KUMO"), `${licenseText}\n`);
const counts = { ui: 0, block: 0 };
for (const cs of groups.values()) if (cs[0].area.kind !== "lib") counts[cs[0].area.kind]++;
console.log(`Generated ${counts.ui} components, ${counts.block} blocks, ${libCopies.length} helper files and ${iconImports.size} icon names from ${release}.`);
if (bound.fallbacks.length) console.log(`notice: new Kumo tokens with no kumo-binding mapping yet (they use Kumo's value): ${bound.fallbacks.join(", ")}`);
