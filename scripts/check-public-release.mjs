import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCommerceProfile } from "./commerce-profile.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const expectedFiles = [
  ".agentic-os.json",
  ".github/workflows/integration.yml",
  ".gitignore",
  "LICENSE",
  "README.md",
  "prd-tad-adr-mvp-gtm-agentic-design-system.md",
  "scripts/check-public-release.mjs",
  "scripts/commerce-profile.mjs",
  "site/THIRD-PARTY-NOTICES.txt",
  "site/app.js",
  "site/catalog.json",
  "site/catalog.schema.json",
  "site/index.html",
  "site/sw.js",
  "site/tokens/commerce-profile.json",
  "site/vendor/agentic-base-browser-data-view.css",
  "site/vendor/agentic-base-browser-data-view.js",
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
if (catalog.$schema !== "./catalog.schema.json" || catalog.catalogId !== "agentic-design-system"
  || catalog.requestedPath !== "/agentic-design-system/" || !/^\d+\.\d+\.\d+$/u.test(catalog.schemaVersion)
  || !Array.isArray(catalog.records) || !catalog.release?.version
  || !["draft", "released", "deprecated"].includes(catalog.release.status)
  || catalog.release.status !== "released" && catalog.records.length > 0) {
  fail("Public catalog does not satisfy its release contract");
}

validateCommerceProfile(await readFile(resolve(root, "site/tokens/commerce-profile.json"), "utf8"));

const notices = await readFile(resolve(root, "site/THIRD-PARTY-NOTICES.txt"), "utf8");
if (!notices.includes("The MIT License (MIT)") || !notices.includes("ISC License")) {
  fail("Third-party license notices are incomplete");
}

console.log(`Public release checks passed for ${expectedFiles.length} files.`);
