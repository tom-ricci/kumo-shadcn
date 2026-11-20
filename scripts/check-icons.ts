#!/usr/bin/env node
// Checks the icon shim against all five icon libraries shadcn supports:
// 1. every name in scripts/icons.ts exists in the real package;
// 2. shadcn's own transform (the code `shadcn add` runs) turns the shim into
//    valid code for each library: no IconPlaceholder left, and tsc passes on
//    the result plus a file that uses the shim the way Kumo does;
// 3. rendered on the server, Phosphor-only props (weight, mirrored) do not
//    leak into the SVG, and size defaults to 1em.
//
//   node scripts/check-icons.ts   (after node scripts/generate.ts)
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { transform } from "@shadcn/registry/internal/transformers/index";
import { ICONS, ICON_LIBRARIES, iconNames, type IconLibrary } from "./icons.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = join(root, ".check", "icons");
const PACKAGES: Record<IconLibrary, string> = {
  lucide: "lucide-react",
  tabler: "@tabler/icons-react",
  hugeicons: "@hugeicons/core-free-icons",
  phosphor: "@phosphor-icons/react",
  remixicon: "@remixicon/react",
};
let failed = false;
const report = (ok: boolean, line: string) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${line}`);
  if (!ok) failed = true;
};

// 1. Names exist.
for (const lib of ICON_LIBRARIES) {
  const mod = await import(PACKAGES[lib]);
  const missing = Object.keys(ICONS).map((k) => iconNames(k)![lib]).filter((n) => !(n in mod));
  report(!missing.length, `icons: ${PACKAGES[lib]} has all ${Object.keys(ICONS).length} mapped names${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
}

// 2. Transform + typecheck.
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const shim = readFileSync(join(root, "registry/kumo/lib/kumo/icons.tsx"), "utf8");
const exported = [...shim.matchAll(/Kumo_\w+ as (\w+)/g)].map((m) => m[1]);
const config = {
  style: "new-york",
  rsc: true,
  tsx: true,
  iconLibrary: "",
  tailwind: { config: "", css: "src/index.css", baseColor: "neutral", cssVariables: true, prefix: "" },
  aliases: { components: "@/components", ui: "@/components/ui", lib: "@/lib", utils: "@/lib/utils", hooks: "@/hooks" },
  resolvedPaths: { cwd: work, tailwindConfig: "", tailwindCss: "", utils: "", components: "", ui: "", lib: "", hooks: "" },
};
const files: string[] = [];
for (const lib of ICON_LIBRARIES) {
  const out = await transform({ filename: "icons.tsx", raw: shim, config: { ...config, iconLibrary: lib } as never, transformJsx: false });
  writeFileSync(join(work, `icons-${lib}.tsx`), out);
  report(!/IconPlaceholder|icon-placeholder/.test(out), `icons: ${lib} transform leaves no IconPlaceholder`);
  // Uses the shim like Kumo does: JSX with Phosphor props, icons as values
  // typed `Icon`, and IconContext defaults.
  writeFileSync(
    join(work, `use-${lib}.tsx`),
    `import * as React from "react";
import * as Shim from "./icons-${lib}";
import { ${iconNames("Check")![lib]} as LibCheck } from "${PACKAGES[lib]}";
const all: Shim.Icon[] = [${exported.map((n) => `Shim.${n}`).join(", ")}];
export const a = all.map((I, i) => <I key={i} size={12} weight="bold" className="size-4" aria-hidden mirrored />);
export const b = <Shim.IconContext.Provider value={{ size: 18 }}><Shim.CheckIcon /></Shim.IconContext.Provider>;
${lib === "hugeicons" ? "" : "export const c: Shim.Icon = LibCheck;\n"}`,
  );
  files.push(`icons-${lib}.tsx`, `use-${lib}.tsx`);
}
writeFileSync(
  join(work, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "react-jsx", strict: true, noEmit: true, skipLibCheck: true, verbatimModuleSyntax: true, types: [] },
    files,
  }),
);
try {
  execFileSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "-p", work], { stdio: "pipe" });
  report(true, "icons: tsc passes for all five transformed shims");
} catch (e) {
  report(false, `icons: tsc failed\n${(e as { stdout: Buffer }).stdout}`);
}

// 3. Render.
const { renderToStaticMarkup } = await import("react-dom/server");
const React = await import("react");
for (const lib of ICON_LIBRARIES) {
  const js = ts.transpileModule(readFileSync(join(work, `icons-${lib}.tsx`), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const file = join(work, `icons-${lib}.mjs`);
  writeFileSync(file, js);
  const mod = await import(pathToFileURL(file).href);
  const html = renderToStaticMarkup(
    React.createElement("div", null, React.createElement(mod.CheckIcon, { weight: "bold", mirrored: true, size: 12 }), React.createElement(mod.X)),
  );
  const leaks = ["weight=", "mirrored"].filter((s) => html.includes(s));
  report(!leaks.length && html.includes('width="12"') && html.includes('width="1em"') && html.includes("scaleX(-1)"), `icons: ${lib} renders (size, 1em default, mirrored; no prop leaks${leaks.length ? `; leaked ${leaks}` : ""})`);
}
if (failed) process.exit(1);
