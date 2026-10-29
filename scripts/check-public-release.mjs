import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDesignRegistry } from "./design-registry.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const expectedFiles = [
  ".agentic-os.json",
  ".github/workflows/integration.yml",
  ".gitignore",
  "LICENSE",
  "README.md",
  "package-lock.json",
  "package.json",
  "prd-tad-adr-mvp-gtm-agentic-design-system.md",
  "scripts/base-profile.mjs",
  "scripts/check-public-release.mjs",
  "scripts/commerce-profile.mjs",
  "scripts/design-registry.mjs",
  "scripts/dev.mjs",
  "scripts/graph-profile.mjs",
  "site/THIRD-PARTY-NOTICES.txt",
  "site/app.js",
  "site/catalog.json",
  "site/catalog.schema.json",
  "site/favicon.svg",
  "site/index.html",
  "site/registry-query.js",
  "site/sw.js",
  "site/tokens/base-profile.json",
  "site/tokens/commerce-profile.json",
  "site/tokens/graph-profile.json",
  "site/vendor/base-profile.css",
  "site/vendor/graph-profile.css",
].sort();
const prohibitedPaths = [
  "registry",
  "registry/owner-ledger.json",
  "site/review-inventory.json",
  "site/vendor/agentic-base-browser-data-view.manifest.json",
];
const secretPatterns = [
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/u,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/u,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
];

function fail(message) {
  throw new Error(message);
}

function verifyContentSecurityPolicy(indexHtml) {
  const meta = [...indexHtml.matchAll(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*>/giu)];
  if (meta.length !== 1) fail('Static HTML must declare exactly one Content-Security-Policy');
  const directives = new Map();
  for (const raw of meta[0][1].split(';')) {
    const [name, ...sources] = raw.trim().split(/\s+/u);
    const normalized = name?.toLowerCase();
    if (!normalized || !/^[a-z][a-z0-9-]*$/u.test(normalized) || !sources.length || directives.has(normalized)) {
      fail('Static CSP contains an empty, malformed, or duplicate directive');
    }
    directives.set(normalized, sources);
  }
  const inlineStyleHashes = [...indexHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/giu)]
    .map(([, css]) => {
      const digest = createHash('sha256').update(css).digest('base64');
      return `'sha256-${digest}'`;
    });
  const hashes = [...new Set(inlineStyleHashes)];
  const required = new Map([
    ['default-src', ["'self'"]], ['connect-src', ["'self'"]], ['script-src', ["'self'"]],
    ['worker-src', ["'self'"]], ['style-src', ["'self'", ...hashes]],
    ['object-src', ["'none'"]], ['base-uri', ["'none'"]], ['form-action', ["'none'"]],
  ]);
  if (directives.size !== required.size) fail('Static CSP contains an unapproved or missing directive');
  for (const [name, sources] of required) {
    const actual = directives.get(name);
    if (!actual || JSON.stringify([...actual].sort()) !== JSON.stringify([...sources].sort())) {
      fail(`Static CSP directive drifted: ${name}`);
    }
  }
  if (/<[^>]+\sstyle\s*=/iu.test(indexHtml)) fail('Inline style attributes are not allowed');
}

function assertCspFailClosedFixtures() {
  const policy = "default-src 'self'; connect-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
  verifyContentSecurityPolicy(`<meta http-equiv="Content-Security-Policy" content="${policy}">`);
  const mustReject = (html, label) => {
    try { verifyContentSecurityPolicy(html); } catch { return; }
    fail(`CSP fixture did not reject ${label}`);
  };
  mustReject(`<meta http-equiv="Content-Security-Policy" content="${policy}; default-src *">`, 'duplicate directives');
  mustReject(`<meta http-equiv="Content-Security-Policy" content="${policy}; img-src https://example.invalid">`, 'unapproved fetch sources');
  const unsafeStylePolicy = policy.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'");
  mustReject(`<meta http-equiv="Content-Security-Policy" content="${unsafeStylePolicy}">`, 'unsafe inline styles');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function listFiles(directory, prefix = "") {
  const rows = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (path === ".git") continue;
    if (!prefix && path === "node_modules") continue;
    if (entry.isSymbolicLink()) fail(`Symlink is not allowed in the public tree: ${path}`);
    if (entry.isDirectory()) rows.push(...await listFiles(resolve(directory, entry.name), path));
    else if (entry.isFile()) rows.push(path);
    else fail(`Special file is not allowed in the public tree: ${path}`);
  }
  return rows;
}

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0").filter(Boolean).sort();
if (JSON.stringify(tracked) !== JSON.stringify(expectedFiles)) fail("Tracked files differ from the public allowlist");

for (const path of prohibitedPaths) {
  try {
    await stat(resolve(root, path));
    fail(`Prohibited internal path is present: ${path}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const onDisk = (await listFiles(root)).sort();
if (JSON.stringify(onDisk) !== JSON.stringify(expectedFiles)) fail("Working tree files differ from the public allowlist");

for (const path of expectedFiles) {
  const bytes = await readFile(resolve(root, path));
  const text = bytes.toString("utf8");
  if (secretPatterns.some((pattern) => pattern.test(text))) fail(`Possible credential pattern in ${path}`);
}

const profile = JSON.parse(await readFile(resolve(root, ".agentic-os.json"), "utf8"));
const { profileDigest, ...profileContent } = profile;
if (profile.schema !== "agentic-os/repository-profile/v1"
  || profile.repository !== "github.com/huijoohwee/agentic-design-system"
  || profile.requiredChecks?.length !== 1 || profile.requiredChecks[0] !== "Integration Gate"
  || !profile.capabilities?.includes("quarantine-worktree-cleanup-opt-in")
  || profile.cleanup?.worktreeProjection !== "quarantine"
  || profile.cleanup?.worktreeRegistration !== "quarantine"
  || createHash("sha256").update(stableJson(profileContent)).digest("hex") !== profileDigest) {
  fail("Repository release profile does not bind the public CI and quarantine policy");
}

const catalog = JSON.parse(await readFile(resolve(root, "site/catalog.json"), "utf8"));
verifyContentSecurityPolicy(await readFile(resolve(root, "site/index.html"), "utf8"));
assertCspFailClosedFixtures();
if (catalog.$schema !== "./catalog.schema.json" || catalog.catalogId !== "agentic-design-system"
  || catalog.requestedPath !== "/agentic-design-system/" || !/^\d+\.\d+\.\d+$/u.test(catalog.schemaVersion)
  || !Array.isArray(catalog.records) || !catalog.release?.version
  || !["draft", "released", "deprecated"].includes(catalog.release.status)
  || catalog.release.status !== "released" && catalog.records.length > 0) {
  fail("Public catalog does not satisfy its release contract");
}

await checkDesignRegistry();

const notices = await readFile(resolve(root, "site/THIRD-PARTY-NOTICES.txt"), "utf8");
if (!notices.includes("MIT License\n")
  || !notices.includes("Commerce theme values\n---------------------\nSource: agentic-commerce-os@6ce3bc918717b97a738ac831dfb4fb3319a02fb6")
  || !notices.includes("Base shared data-view values\n---------------------------\nSource: agentic-base@a5d0f2d87d8c6871e9639f8224f5eaee056c5b6e")
  || !notices.includes("Graph token and typography values\n-------------------------------\nSource: agentic-graph@bed770d91a9b3f1b663eee9637a472bf19b36361")
  || !notices.includes("User grant 2026-10-29: public reuse of the exact four Graph artifacts listed here")) {
  fail("Third-party license notices are incomplete");
}

console.log(`Public release checks passed for ${expectedFiles.length} files.`);
