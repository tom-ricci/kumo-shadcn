#!/usr/bin/env node
// Compares kumo-binding (over shadcn's default neutral theme) with Kumo's own
// theme, token by token, in light and dark mode. Colors are computed by a
// headless Chromium; translucent tokens are composited over each theme's
// --kumo-base. Prints the OKLab difference (ΔE × 100; under ~2 is hard to
// see, under ~5 reads as the same color) for tuning packages/registry/src/themes.ts.
//
//   CHROMIUM=/path/to/chromium node packages/registry/src/compare-themes.ts   (after generate + build)
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."); // the repository root
const chromium = process.env.CHROMIUM ?? "chromium";
const registry = JSON.parse(readFileSync(join(root, "registry.json"), "utf8"));
const item = (name: string) => registry.items.find((i: { name: string }) => i.name === name);
type Vars = Record<string, string>;

// shadcn's default neutral theme (base-nova), as `shadcn init` writes it.
const shadcnLight: Vars = {
  "--background": "oklch(1 0 0)", "--foreground": "oklch(0.145 0 0)", "--card": "oklch(1 0 0)", "--card-foreground": "oklch(0.145 0 0)",
  "--popover": "oklch(1 0 0)", "--popover-foreground": "oklch(0.145 0 0)", "--primary": "oklch(0.205 0 0)", "--primary-foreground": "oklch(0.985 0 0)",
  "--secondary": "oklch(0.97 0 0)", "--secondary-foreground": "oklch(0.205 0 0)", "--muted": "oklch(0.97 0 0)", "--muted-foreground": "oklch(0.556 0 0)",
  "--accent": "oklch(0.97 0 0)", "--accent-foreground": "oklch(0.205 0 0)", "--destructive": "oklch(0.577 0.245 27.325)",
  "--border": "oklch(0.922 0 0)", "--input": "oklch(0.922 0 0)", "--ring": "oklch(0.708 0 0)",
};
const shadcnDark: Vars = {
  "--background": "oklch(0.145 0 0)", "--foreground": "oklch(0.985 0 0)", "--card": "oklch(0.205 0 0)", "--card-foreground": "oklch(0.985 0 0)",
  "--popover": "oklch(0.205 0 0)", "--popover-foreground": "oklch(0.985 0 0)", "--primary": "oklch(0.922 0 0)", "--primary-foreground": "oklch(0.205 0 0)",
  "--secondary": "oklch(0.269 0 0)", "--secondary-foreground": "oklch(0.985 0 0)", "--muted": "oklch(0.269 0 0)", "--muted-foreground": "oklch(0.708 0 0)",
  "--accent": "oklch(0.269 0 0)", "--accent-foreground": "oklch(0.985 0 0)", "--destructive": "oklch(0.704 0.191 22.216)",
  "--border": "oklch(1 0 0 / 10%)", "--input": "oklch(1 0 0 / 15%)", "--ring": "oklch(0.556 0 0)",
};

// Tailwind's default palette, which Kumo's values reference with var().
const twTheme = readFileSync(join(root, "node_modules/tailwindcss/theme.css"), "utf8");
const palette = Object.fromEntries([...twTheme.matchAll(/(--color-[a-z]+-\d+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]));
const primitives: Vars = item("kumo-base").css["@layer base"][":root"];

const kumoLayer = item("kumo-theme").css["@layer base"];
const kumoLight: Vars = kumoLayer[':root, [data-theme="kumo"]'];
const kumoDark: Vars = Object.entries(kumoLayer).find(([k]) => k.startsWith(':root[data-mode="dark"]'))![1] as Vars;
const bindLayer = item("kumo-binding").css["@layer base"];
const supports = Object.entries(bindLayer).find(([k]) => k.startsWith("@supports"))![1] as Record<string, Vars>;
const tokens = Object.keys(kumoLight).filter((k) => k.startsWith("--kumo-"));

const decls = (v: Vars) => Object.entries(v).map(([k, val]) => `${k}: ${val};`).join(" ");
const css = `
:root { ${decls(palette)} ${decls(primitives)} }
.k-light { ${decls(kumoLight)} } .k-dark { ${decls(kumoDark)} }
.b-light { ${decls(shadcnLight)} ${decls(bindLayer[":root"])} ${decls(supports[":root"])} }
.b-dark { ${decls(shadcnDark)} ${decls(bindLayer[".dark"])} ${decls(supports[".dark"])} }`;
const probes = (cls: string) => `<div class="${cls}" data-set="${cls}">${tokens.map((t) => `<i data-t="${t}" style="color: var(${t})"></i>`).join("")}<b style="color: var(--kumo-base)"></b></div>`;
const html = `<!doctype html><style>${css}</style>${["k-light", "k-dark", "b-light", "b-dark"].map(probes).join("")}<pre id="out"></pre>
<script>
const ctx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
const px = (bg, fg) => { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1, 1); ctx.fillStyle = bg; ctx.fillRect(0, 0, 1, 1); ctx.fillStyle = fg; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
const out = {};
for (const set of document.querySelectorAll("[data-set]")) {
  const base = getComputedStyle(set.querySelector("b")).color;
  out[set.dataset.set] = Object.fromEntries([...set.querySelectorAll("i")].map((i) => [i.dataset.t, px(base, getComputedStyle(i).color)]));
}
document.getElementById("out").textContent = JSON.stringify(out);
</script>`;
const work = join(root, ".check", "compare");
mkdirSync(work, { recursive: true });
writeFileSync(join(work, "compare.html"), html);
const dom = execFileSync(chromium, ["--headless", "--no-sandbox", "--disable-gpu", "--virtual-time-budget=2000", "--dump-dom", `file://${join(work, "compare.html")}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const result = JSON.parse(dom.match(/<pre id="out">([^<]*)<\/pre>/)![1].replace(/&quot;/g, '"'));

// sRGB 0-255 -> OKLab
const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function oklab([r, g, b]: number[]) {
  const [R, G, B] = [r, g, b].map(lin);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const dE = (a: number[], b: number[]) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i])) * 100;
const L = (c: number[]) => (oklab(c)[0] * 100).toFixed(1);

console.log("token".padEnd(30), "light: kumo  binding  ΔE".padEnd(30), "dark: kumo  binding  ΔE");
let worst = 0;
for (const t of tokens) {
  const row = (["light", "dark"] as const).map((m) => {
    const k = result[`k-${m}`][t], b = result[`b-${m}`][t];
    const d = dE(k, b);
    worst = Math.max(worst, d);
    return `L${L(k).padStart(5)}  L${L(b).padStart(5)}  ${d.toFixed(1).padStart(5)}`;
  });
  console.log(t.padEnd(30), row[0].padEnd(30), row[1]);
}
console.log(`largest ΔE: ${worst.toFixed(1)}`);
