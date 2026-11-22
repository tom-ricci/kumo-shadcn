#!/usr/bin/env node
// Checks the highlight hook in built verification apps (packages/verify/verify.sh):
// hovers a ghost button, opens a dropdown and hovers an item, and reads the
// sidebar's active item, with real mouse events in headless Chromium (CDP).
// Under kumo-theme the backgrounds must be Kumo's tint (light 97%, dark
// 26.9%); under kumo-cloudflare the highlight shade (light 96.5%, dark 20.5%).
// Also saves a screenshot of the states for each app and mode.
//
//   CHROMIUM=... node packages/verify/check-highlight.ts <out-dir> <dist-dir>=<kumo-theme|kumo-cloudflare> ...
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { extname, join } from "node:path";

const [outDir, ...apps] = process.argv.slice(2);
const EXPECTED_L: Record<string, { light: number; dark: number }> = {
  "kumo-theme": { light: 97, dark: 26.9 },
  "kumo-cloudflare": { light: 96.5, dark: 20.5 },
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const report = (ok: boolean, line: string) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${line}`);
  if (!ok) failed = true;
};
await mkdir(outDir, { recursive: true });

// Static server for each dist directory (SPA fallback to index.html).
const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const urls = await Promise.all(
  apps.map(
    (arg) =>
      new Promise<string>((resolve) => {
        const dir = arg.split("=")[0];
        const server = createServer(async (req, res) => {
          const path = new URL(req.url ?? "/", "http://x").pathname;
          const file = join(dir, path.includes("..") || path === "/" ? "index.html" : path);
          try {
            res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(await readFile(file));
          } catch {
            res.writeHead(200, { "content-type": "text/html" }).end(await readFile(join(dir, "index.html")));
          }
        });
        server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(server.address() as { port: number }).port}/`));
        server.unref();
      }),
  ),
);

// Chromium with the DevTools protocol.
const profile = await mkdtemp(join(tmpdir(), "kumo-highlight-"));
const chrome = spawn(process.env.CHROMIUM ?? "chromium", ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--window-size=1000,1400",
  // Headless reports no hover-capable pointer, and Tailwind wraps hover: in @media (hover: hover).
  "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4", "about:blank"], { stdio: "ignore" });
let targets: { type: string; webSocketDebuggerUrl: string }[] = [];
for (let i = 0; i < 100 && !targets.some((t) => t.type === "page"); i++) {
  await sleep(200);
  const devtoolsPort = (await readFile(join(profile, "DevToolsActivePort"), "utf8").catch(() => "")).split("\n")[0];
  if (devtoolsPort) targets = await fetch(`http://127.0.0.1:${devtoolsPort}/json`).then((r) => r.json()).catch(() => []);
}
const ws = new WebSocket(targets.find((t) => t.type === "page")!.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 0;
const pending = new Map<number, (v: any) => void>();
// If the browser goes away mid-run, fail now instead of waiting on replies that never come.
let finished = false;
ws.addEventListener("close", () => {
  if (finished) return;
  console.log("FAIL highlight: the browser closed the DevTools connection");
  process.exit(1);
});
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(String(e.data));
  if (msg.id !== undefined) pending.get(msg.id)?.(msg.result ?? msg);
});
const cdp = (method: string, params: object = {}) =>
  new Promise<any>((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression: string) => (await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;
// OKLab lightness (%) of an element's computed background, via a canvas.
const lightness = (selector: string) =>
  evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null;
    const c = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    c.fillStyle = getComputedStyle(el).backgroundColor; c.fillRect(0, 0, 1, 1);
    const [r, g, b] = [...c.getImageData(0, 0, 1, 1).data].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    const l = Math.cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b), m = Math.cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b), s = Math.cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b);
    return Math.round((0.2104542553*l + 0.793617785*m - 0.0040720468*s) * 1000) / 10;
  })()`);
// Center of an element, or a far corner when it isn't on the page (the
// reading that follows then fails instead of the script crashing).
const center = async (selector: string): Promise<number[]> =>
  (await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`)) ?? [999, 999];
const mouse = async (type: string, [x, y]: number[]) => cdp("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });

for (const [i, arg] of apps.entries()) {
  const [dir, theme] = arg.split("=");
  const name = dir.split("/").filter(Boolean).at(-2);
  for (const mode of ["light", "dark"] as const) {
    await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: mode }] });
    await cdp("Page.navigate", { url: urls[i] });
    await sleep(2500);
    const want = EXPECTED_L[theme][mode];
    const check = (what: string, got: number | null) =>
      report(got !== null && Math.abs(got - want) <= 0.6, `${name} ${mode}: ${what} background L=${got}% (want ${want}%)`);

    await mouse("mouseMoved", [1, 1]);
    check("sidebar active item", await lightness('[data-check="sidebar-active"]'));
    await mouse("mouseMoved", await center('[data-check="ghost"]'));
    await sleep(500);
    check("ghost button hover", await lightness('[data-check="ghost"]'));
    const trigger = await center('[data-check="dropdown-trigger"]');
    await mouse("mousePressed", trigger);
    await mouse("mouseReleased", trigger);
    await sleep(700);
    await mouse("mouseMoved", await center('[data-check="dropdown-item"]'));
    await sleep(500);
    check("dropdown item highlighted", await lightness('[data-check="dropdown-item"]'));
    const top = (await evaluate(`document.querySelector('[data-check="states"]')?.getBoundingClientRect().top + scrollY`)) ?? 24;
    const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 40, y: Math.max(0, top - 24), width: 760, height: 220, scale: 1 } });
    await writeFile(join(outDir, `${name}-${mode}.png`), Buffer.from(shot.data, "base64"));
  }
}
finished = true;
ws.close();
chrome.kill();
process.exit(failed ? 1 : 0);
