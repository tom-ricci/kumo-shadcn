#!/usr/bin/env node
// Checks the requirements for listing this registry in the shadcn registry
// directory (https://ui.shadcn.com/docs/registry/registry-index) against the
// built registry (public/r) and the prepared entry (directory/entry.json):
//
// - the entry passes the directory's own schema rules (shadcn-ui/ui,
//   apps/v4/lib/registry-directory.ts): namespace pattern, URLs, a {name}
//   placeholder, description, logo, no other keys;
// - the registry index (registry.json at the template's base) validates
//   against the CLI's registrySchema, and so does every item;
// - the registry is flat: the index and every item sit at the base of the
//   URL template, with no nested paths;
// - files in the index have no `content`;
// - item names are unique, and the registry name matches the namespace
//   (Registry Health, "Registry setup");
// - the template is HTTPS and the project is open source (a LICENSE).
//
//   node packages/registry/src/check-directory.ts   (after npm run registry)
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registryItemSchema, registrySchema } from "shadcn/schema";
import { BASE_URL, NAMESPACE } from "./config.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."); // the repository root
const built = join(root, "public", "r");
let failed = false;
const report = (ok: boolean, line: string) => {
  console.log(`${ok ? "PASS" : "FAIL"} directory: ${line}`);
  if (!ok) failed = true;
};
const isUrl = (v: unknown) => {
  try {
    return typeof v === "string" && Boolean(new URL(v));
  } catch {
    return false;
  }
};

const entry = JSON.parse(readFileSync(join(root, "directory", "entry.json"), "utf8"));
const allowed = new Set(["name", "homepage", "url", "description", "author", "logo"]);
report(/^@[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(entry.name), `entry name ${entry.name} matches ^@[a-zA-Z0-9][a-zA-Z0-9_-]*$`);
report(isUrl(entry.homepage), "entry homepage is a URL");
report(isUrl(entry.url) && entry.url.includes("{name}"), "entry url is a URL with a {name} placeholder");
report(entry.url.startsWith("https://"), "entry url uses HTTPS");
report(typeof entry.description === "string" && entry.description.length > 0, "entry has a description");
report(typeof entry.logo === "string" && entry.logo.trim().startsWith("<svg"), "entry has an inline SVG logo");
report(entry.author === undefined || typeof entry.author === "string", "entry author, if any, is a string");
report(Object.keys(entry).every((k) => allowed.has(k)), `entry has only ${[...allowed].join(", ")}`);
report(entry.name === NAMESPACE, `entry name is the registry's namespace ${NAMESPACE} (config.ts)`);
report(entry.url === `${BASE_URL}/{name}.json`, `entry url is ${BASE_URL}/{name}.json, where registryDependencies point (config.ts)`);

const index = JSON.parse(readFileSync(join(built, "registry.json"), "utf8"));
const parsed = registrySchema.safeParse(index);
report(parsed.success, `public/r/registry.json validates against registrySchema${parsed.success ? "" : `: ${parsed.error.message.slice(0, 300)}`}`);
report(`@${index.name}` === entry.name, `registry name "${index.name}" matches the namespace ${entry.name}`);
const names = index.items.map((i: { name: string }) => i.name);
report(new Set(names).size === names.length, `${names.length} item names, all unique`);
report(index.items.every((i: { files?: object[] }) => (i.files ?? []).every((f) => !("content" in f))), "no files[].content in the index");
// Flat: the template's base holds registry.json and <item>.json for every item.
const template = entry.url.replace(/^https:\/\/[^/]+\//, "");
const flat = /^([^{}]*\/)?\{name\}\.json$/.test(template) && template.replace("{name}.json", "") === "r/";
report(flat, `url template path /${template} is flat and maps to public/r/ (where the Worker serves it)`);
const missing = names.filter((n: string) => !existsSync(join(built, `${n}.json`)));
report(!missing.length, `every item has public/r/<name>.json${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
const invalid = names.filter((n: string) => existsSync(join(built, `${n}.json`)) && !registryItemSchema.safeParse(JSON.parse(readFileSync(join(built, `${n}.json`), "utf8"))).success);
report(!invalid.length, `every item validates against registryItemSchema${invalid.length ? ` (invalid: ${invalid.join(", ")})` : ""}`);
report(existsSync(join(root, "LICENSE")), "open source: LICENSE (MIT) is present");
if (failed) process.exit(1);
