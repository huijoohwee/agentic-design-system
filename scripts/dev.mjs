import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const site = resolve(fileURLToPath(new URL("../site", import.meta.url)));
const host = "127.0.0.1";
const requestedHost = process.env.HOST;
if (requestedHost && requestedHost !== host) throw new Error("The design-system server only binds to 127.0.0.1");

const portText = process.env.PORT ?? "4173";
if (!/^(?:0|[1-9][0-9]{0,4})$/u.test(portText) || Number(portText) > 65535) {
  throw new Error("PORT must be an integer from 0 to 65535");
}

const files = new Set([
  "index.html", "app.js", "registry-query.js", "sw.js", "favicon.svg", "catalog.json", "catalog.schema.json", "THIRD-PARTY-NOTICES.txt",
  "tokens/commerce-profile.json", "tokens/base-profile.json", "tokens/graph-profile.json",
  "vendor/base-profile.css", "vendor/graph-profile.css",
]);
const types = new Map([
  [".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"], [".svg", "image/svg+xml"],
]);

async function readPublicFile(relativePath) {
  if (!files.has(relativePath)) return null;
  const path = resolve(site, relativePath);
  if (!path.startsWith(`${site}${sep}`)) return null;
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile()) return null;
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

const server = createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method ?? "")) {
    response.writeHead(405, { Allow: "GET, HEAD", "Cache-Control": "no-store" }).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${host}`).pathname);
  } catch {
    response.writeHead(400, { "Cache-Control": "no-store" }).end("Bad request");
    return;
  }
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\//u, "");
  try {
    const body = await readPublicFile(relativePath);
    if (!body) {
      response.writeHead(404, { "Cache-Control": "no-store" }).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Length": body.byteLength,
      "Content-Type": types.get(extname(relativePath)) ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    const status = error.code === "ENOENT" ? 404 : 500;
    response.writeHead(status, { "Cache-Control": "no-store" }).end(status === 404 ? "Not found" : "Local file read failed");
    if (status === 500) console.error(`Static read failed for ${relativePath}: ${error.message}`);
  }
});

server.listen(Number(portText), host, () => {
  const address = server.address();
  console.log(`Agentic Design System is live at http://${host}:${address.port}/`);
  console.log("Loopback only · static files · no external runtime requests");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
