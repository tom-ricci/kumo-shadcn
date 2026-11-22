#!/usr/bin/env node
// Serves public/r on localhost for packages/verify/verify.sh. Item JSON is served as
// built, except that the production base URL in registryDependencies is
// rewritten to this server, so the verified files are the published ones.
//
//   node packages/registry/src/serve-registry.ts [port]   (0 or none: a free port; prints the URL)
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "public", "r");
const PROD = "https://raw.githubusercontent.com/tom-ricci/kumo-shadcn/main/public/r";
let local = "";

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? "/", local).pathname)).replace(/^\/r\//, "");
  try {
    if (path.includes("..") || !path.endsWith(".json")) throw new Error("not found");
    const body = (await readFile(join(root, path), "utf8")).split(PROD).join(local);
    res.writeHead(200, { "content-type": "application/json" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
server.listen(Number(process.argv[2] ?? 0), "127.0.0.1", () => {
  local = `http://127.0.0.1:${(server.address() as { port: number }).port}/r`;
  console.log(`registry at ${local}`);
});
