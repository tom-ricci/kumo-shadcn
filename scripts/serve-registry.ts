#!/usr/bin/env node
// Serves public/r on localhost for scripts/verify.sh. Item JSON is served as
// built, except that the production base URL in registryDependencies is
// rewritten to this server, so the verified files are the published ones.
//
//   node scripts/serve-registry.ts [port]
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "r");
const port = Number(process.argv[2] ?? 4873);
const PROD = "https://raw.githubusercontent.com/tom-ricci/kumo-shadcn/main/public/r";
const local = `http://127.0.0.1:${port}/r`;

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? "/", local).pathname)).replace(/^\/r\//, "");
  try {
    if (path.includes("..") || !path.endsWith(".json")) throw new Error("not found");
    const body = (await readFile(join(root, path), "utf8")).split(PROD).join(local);
    res.writeHead(200, { "content-type": "application/json" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`registry at ${local}`));
