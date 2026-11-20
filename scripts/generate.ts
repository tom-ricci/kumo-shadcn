#!/usr/bin/env node
// Generates the kumo-shadcn registry from Kumo's source code.
//
//   node scripts/generate.ts --kumo <path to a checkout of cloudflare/kumo> [--base-url <url>]
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

const HOMEPAGE = "https://github.com/tom-ricci/kumo-shadcn";
const DEFAULT_BASE_URL = "https://raw.githubusercontent.com/tom-ricci/kumo-shadcn/main/public/r";
// IconPlaceholder is shadcn's marker element. The CLI removes this import when
// it installs the file; the path only has to contain "icon-placeholder" and
// must not start with @/registry/ (the CLI's alias rewrite would mangle that).
const ICON_PLACEHOLDER_IMPORT = "@/app/(create)/components/icon-placeholder";

const { values: args } = parseArgs({
  options: { kumo: { type: "string" }, "base-url": { type: "string" } },
});
if (!args.kumo) fail("usage: node scripts/generate.ts --kumo <kumo checkout> [--base-url <url>]");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kumoRepo = resolve(args.kumo);
const kumoPkgDir = join(kumoRepo, "packages", "kumo");
const src = join(kumoPkgDir, "src");
const baseUrl = (args["base-url"] ?? DEFAULT_BASE_URL).replace(/\/$/, "");
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

function areaOf(file: string): Area | undefined {
  const parts = posix(relative(src, file)).split("/");
  if (parts[0] === "components" && parts.length > 2) return { kind: "ui", item: parts[1], rel: parts.slice(2).join("/") };
  if (parts[0] === "blocks" && parts.length > 2) return { kind: "block", item: parts[1], rel: parts.slice(2).join("/") };
  if (parts[0] === "utils" && parts.length > 1) return { kind: "lib", item: "kumo-utils", rel: parts.slice(1).join("/") };
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
    replace: "[--sidebar-active-bg:var(--kumo-sidebar-active-bg,var(--color-kumo-tint))] [--sidebar-bg:var(--kumo-sidebar-bg,var(--color-kumo-base))]",
    why: "the sidebar's default colors read --kumo-sidebar-bg and --kumo-sidebar-active-bg first",
  },
];
const appliedPatches = new Set<string>();
function patchSource(where: string, text: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  for (const p of SOURCE_PATCHES.filter((p) => p.file === where)) {
    const count = text.split(p.find).length - 1;
    if (count !== 1) fail(`source patch for ${where} matched ${count} times (expected 1): ${p.find}`);
    text = text.replace(p.find, p.replace);
    appliedPatches.add(p.find);
    notes.push(p.why);
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

function moduleSpecifiers(sf: ts.SourceFile): { node: ts.StringLiteralLike; decl?: ts.ImportDeclaration; sideEffect: boolean }[] {
  const found: { node: ts.StringLiteralLike; decl?: ts.ImportDeclaration; sideEffect: boolean }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push({ node: node.moduleSpecifier, decl: node, sideEffect: !node.importClause });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push({ node: node.moduleSpecifier, sideEffect: false });
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

  for (const { node, decl, sideEffect } of moduleSpecifiers(sf)) {
    const spec = node.text;
    if (sideEffect && !spec.startsWith(".")) fail(`unknown import pattern: side-effect import "${spec}" in ${where}`);
    if (spec.startsWith(".")) {
      const target = resolveRelative(file, spec);
      const targetArea = areaOf(target)!;
      copied.localFiles.add(target);
      if (targetArea.kind === area.kind && targetArea.item === area.item) continue; // same item: keep relative
      replaceSpec(node, aliasPath(targetArea));
      copied.registryDependencies.add(targetArea.item);
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

  let body = text;
  for (const e of edits.sort((a, b) => b.start - a.start)) body = body.slice(0, e.start) + e.text + body.slice(e.end);
  // Kumo's build puts "use client" at the top of every chunk, and so does
  // this copy. It also keeps the license header: the shadcn CLI strips
  // comments before the first statement of a file, but not after it.
  const first = sf.statements[0];
  if (first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === "use client")
    body = body.slice(0, first.getFullStart()) + body.slice(first.getEnd()).replace(/^\s*\n/, "");
  copied.code = `"use client";\n\n${sourceHeader(where, patched.notes)}${body.replace(/^\s+/, "")}`;
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
    "// Changes from Kumo's file: import paths, and the \"use client\" line Kumo's build adds.",
    ...notes.map((n) => `// Also changed: ${n}.`),
    "// Unofficial; not affiliated with or endorsed by Cloudflare.",
    "//",
    licenseComment,
    "",
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
    registryDependencies: [itemUrl("kumo-base")],
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
  registryDependencies: [itemUrl("kumo-base")],
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
for (const [name, cs] of [...groups].sort(([a], [b]) => cmp(a, b))) {
  if (name === "kumo-utils") continue;
  const kind = cs[0].area.kind;
  if (kind === "ui" && !exported.has(name)) console.warn(`note: components/${name} has no ./components/${name} entry in Kumo's package.json`);
  const regDeps = union(cs, "registryDependencies").filter((d) => d !== name);
  items.push({
    name,
    type: kind === "ui" ? "registry:ui" : "registry:block",
    title: pascal(name),
    description: `Kumo ${pascal(name)} ${kind === "ui" ? "component" : "block"}, copied from ${release}.`,
    dependencies: union(cs, "dependencies"),
    devDependencies: union(cs, "devDependencies"),
    registryDependencies: sorted(new Set(["kumo-base", ...regDeps])).map(itemUrl),
    files: cs.sort(byPath).map((c) => fileEntry(c, kind === "ui" ? "registry:ui" : "registry:component")),
  });
}
for (const item of items) for (const key of ["dependencies", "devDependencies", "registryDependencies"]) if (Array.isArray(item[key]) && !(item[key] as unknown[]).length) delete item[key];

writeFileSync(
  join(root, "registry.json"),
  `${JSON.stringify({ $schema: "https://ui.shadcn.com/schema/registry.json", name: "kumo", homepage: HOMEPAGE, items }, null, 2)}\n`,
);
writeFileSync(join(root, "registry", "kumo", "VERSION"), `${release}\n`);
const counts = { ui: 0, block: 0 };
for (const cs of groups.values()) if (cs[0].area.kind !== "lib") counts[cs[0].area.kind]++;
console.log(`Generated ${counts.ui} components, ${counts.block} blocks, ${libCopies.length} helper files and ${iconImports.size} icon names from ${release}.`);
if (bound.fallbacks.length) console.log(`notice: new Kumo tokens with no kumo-binding mapping yet (they use Kumo's value): ${bound.fallbacks.join(", ")}`);
