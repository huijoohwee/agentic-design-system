import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateIconLibrary } from "./design-system-icon-profile.mjs";
import { checkDesignRegistry } from "./design-registry.mjs";
import { prepareLocalDevHtml } from "./dev-csp.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const expectedFiles = [
  ".agentic-os.json",
  ".github/workflows/integration.yml",
  ".gitignore",
  "guides/floating-panel-contract.md",
  "LICENSE",
  "README.md",
  "package-lock.json",
  "package.json",
  "prd-tad-adr-mvp-gtm-agentic-design-system.md",
  "scripts/base-profile.mjs",
  "scripts/check-public-release.mjs",
  "scripts/commerce-profile.mjs",
  "scripts/dashboard-layout-css.mjs", "scripts/dashboard-layout-service.mjs", "scripts/dashboard-layout-service.test.mjs",
  "scripts/design-registry.mjs",
  "scripts/design-system-icon-profile.mjs",
  "scripts/dev-csp.mjs", "scripts/dev.mjs",
  "scripts/graph-profile.mjs",
  "scripts/panel-controls.test.mjs",
  "site/THIRD-PARTY-NOTICES.txt",
  "site/app.js",
  "site/catalog.json",
  "site/catalog.schema.json",
  "site/favicon.svg",
  "site/floating-panel.css", "site/toolbar.css", "site/toolbar-icons.js", "site/dashboard-columns.js",
  "site/index.html",
  "site/floating-panel-contract.d.ts",
  "site/icons.json",
  "site/registry.css",
  "site/registry-query.js",
  "site/sw.js",
  "site/tokens/base-profile.json",
  "site/tokens/commerce-profile.json",
  "site/tokens/graph-profile.json",
  "site/tokens/shared-ui-profile.json",
  "site/vendor/base-profile.css",
  "site/vendor/commerce-theme.css",
  "site/vendor/graph-profile.css",
  "site/vendor/shared-ui-profile.css",
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

async function assertFloatingPanelOwnerContract(indexHtml) {
  const triggerIdCount = [...indexHtml.matchAll(/\bid="floating-panel-preview-trigger"/gu)].length;
  const panelIdCount = [...indexHtml.matchAll(/\bid="panel-preview"/gu)].length;
  const triggerUsesSharedDock = /<button\b(?=[^>]*\bid="floating-panel-preview-trigger")(?=[^>]*\bdata-icon-only)(?=[^>]*\bdata-dock-edge="end")(?=[^>]*\baria-label="FloatingPanel")[^>]*>\s*<svg\b[^>]*data-agentic-design-icon="SlidersHorizontal"[^>]*><\/svg>\s*<\/button>/u.test(indexHtml);
  const closeUsesSemanticRole = /<button\b(?=[^>]*\bdata-agentic-panel-control="close")(?=[^>]*\bdata-panel-close)[^>]*>\s*<\/button>/u.test(indexHtml);
  const tabKeys = [...indexHtml.matchAll(/data-agentic-floating-panel-tab-key="([^"]+)"/gu)].map(([, key]) => key);
  const tabControls = [...indexHtml.matchAll(/role="tab"[^>]*aria-controls="([^"]+)"/gu)].map(([, id]) => id);
  const tabPanels = [...indexHtml.matchAll(/<section\b(?=[^>]*role="tabpanel")(?=[^>]*id="([^"]+)")/gu)].map(([, id]) => id);
  if (triggerIdCount !== 1 || panelIdCount !== 1 || !triggerUsesSharedDock || !closeUsesSemanticRole
    || [...indexHtml.matchAll(/role="tablist"/gu)].length !== 1
    || tabKeys.length !== 3 || new Set(tabKeys).size !== tabKeys.length
    || tabControls.length !== tabKeys.length || new Set(tabControls).size !== tabControls.length
    || JSON.stringify([...tabControls].sort()) !== JSON.stringify([...tabPanels].sort())) {
    fail("FloatingPanel preview must use one shared top-right trigger, one shell, and unique icon tabs with matching panels");
  }

  const controlRuntime = await readFile(resolve(root, "site/toolbar-icons.js"), "utf8");
  const appRuntime = await readFile(resolve(root, "site/app.js"), "utf8");
  if (!controlRuntime.includes("export function applyPanelControl(button, control)")
    || !controlRuntime.includes("export function createPanelControlButton(control")
    || !controlRuntime.includes("export function hydratePanelControls(root")
    || !controlRuntime.includes("export function updatePanelControlButton(button, control")
    || !controlRuntime.includes("export function resolvePanelControlRoles({ actions = {}, minimized = false }")
    || !controlRuntime.includes("export function updatePanelControlGroup(group, {")
    || !controlRuntime.includes('const roles = Object.keys(definitions)')
    || !controlRuntime.includes('return roles.filter(control =>')
    || !controlRuntime.includes("if (typeof actions[control] !== 'function') return false")
    || !controlRuntime.includes("cache.get(currentRoles[index]) !== child")
    || !controlRuntime.includes("const PANEL_CONTROL_GROUP_CLASS = 'agentic-panel-control-group'")
    || !controlRuntime.includes("cannot override its canonical")
    || !controlRuntime.includes("cannot replace its existing semantic role")
    || !controlRuntime.includes("cannot apply consumer visual overrides")
    || !controlRuntime.includes("cannot contain consumer controls")
    || !appRuntime.includes("hydratePanelControls(document)")
    || /aria-label="Close FloatingPanel"|title="Close FloatingPanel"/u.test(indexHtml)) {
    fail("Panel controls must get their icon and accessible name from one semantic role, without consumer overrides");
  }

  const panelCss = await readFile(resolve(root, "site/floating-panel.css"), "utf8");
  const sharedUiCss = await readFile(resolve(root, "site/vendor/shared-ui-profile.css"), "utf8");
  if (!sharedUiCss.includes("--agentic-control-hover-background: light-dark(#fffbeb, rgb(251 191 36 / 0.16));")
    || !sharedUiCss.includes("--agentic-icon-size-default: 1rem;")
    || !sharedUiCss.includes("inline-size: var(--agentic-icon-size-default); block-size: var(--agentic-icon-size-default);")
    || !panelCss.includes("background: var(--agentic-control-hover-background);")
    || !panelCss.includes(".agentic-base-floating-panel .agentic-base-floating-panel-close:hover { background: var(--agentic-control-hover-background); }")
    || panelCss.includes("--kg-panel-action-bg-hover")
    || !panelCss.includes("box-shadow: none; transform: none; filter: none;")
    || !panelCss.includes(":is(.agentic-floating-panel-tab, .agentic-base-floating-panel-close):has(> .agentic-icon:only-child)")
    || /(?:inline-size|block-size|width|height):\s*(?:12|14|16|18|20|24|28|38|48)px\b/u.test(panelCss)) {
    fail("FloatingPanel icons and square close/tab controls must use the central icon and control tokens");
  }
  const toolbarCss = await readFile(resolve(root, "site/toolbar.css"), "utf8");
  if (!toolbarCss.includes(".agentic-toolbar-item:hover { background: var(--agentic-control-hover-background); }")
    || /--(?:agentic-base-hover|kg-panel-bg-hover|kg-panel-action-bg-hover)/u.test(sharedUiCss)) {
    fail("Shared controls must use one canonical hover-background token");
  }

  const duplicatePanelRule = /\.(?:agentic-base-floating-panel(?:-[a-z0-9-]+)?|agentic-floating-panel-(?:tabs|tab|title|body|dock))\b/iu;
  for (const path of expectedFiles.filter(file => file.endsWith(".css") && file !== "site/floating-panel.css")) {
    const stylesheet = await readFile(resolve(root, path), "utf8");
    if (duplicatePanelRule.test(stylesheet)) fail(`${path} duplicates the central FloatingPanel stylesheet owner`);
  }
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

function assertLocalDevCspFixtures(indexHtml) {
  const match = indexHtml.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*>/iu);
  if (!match) fail("Local Dev CSP fixture requires the production policy source");
  const dev = prepareLocalDevHtml("index.html", "text/html; charset=utf-8", Buffer.from(indexHtml));
  if (!dev || dev.reportOnlyPolicy !== `${match[1]}; style-src-elem 'self' 'unsafe-inline'`
    || /<meta\s+http-equiv="Content-Security-Policy"/iu.test(dev.body.toString("utf8"))) {
    fail("Local Dev must derive one report-only annotation exception from the strict static CSP");
  }
  if (prepareLocalDevHtml("registry.css", "text/css; charset=utf-8", Buffer.from("body {}")) !== null
    || prepareLocalDevHtml("index.html", "text/css; charset=utf-8", Buffer.from(indexHtml)) !== null) {
    fail("Local annotation CSP exception must be limited to the local HTML response");
  }
  const mustReject = (html, label) => {
    try { prepareLocalDevHtml("index.html", "text/html; charset=utf-8", Buffer.from(html)); } catch { return; }
    fail(`Local Dev CSP accepted ${label}`);
  };
  mustReject(indexHtml.replace(match[1], `${match[1]}; style-src-elem 'self'`), "an overlapping style-src-elem directive");
  mustReject(indexHtml.replace(match[1], match[1].replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")), "an unsafe production base policy");
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
const cleanupMode = profile.cleanup?.worktreeProjection;
const cleanupCapability = cleanupMode === "remove-clean"
  ? "remove-clean-worktree-cleanup-opt-in"
  : cleanupMode === "quarantine" ? "quarantine-worktree-cleanup-opt-in" : null;
if (profile.schema !== "agentic-os/repository-profile/v1"
  || profile.repository !== "github.com/huijoohwee/agentic-design-system"
  || profile.requiredChecks?.length !== 1 || profile.requiredChecks[0] !== "Integration Gate"
  || !profile.capabilities?.includes("protected-integration:pull-request")
  || !cleanupCapability || !profile.capabilities?.includes(cleanupCapability)
  || profile.capabilities?.includes(cleanupMode === "remove-clean"
    ? "quarantine-worktree-cleanup-opt-in" : "remove-clean-worktree-cleanup-opt-in")
  || profile.cleanup?.worktreeRegistration !== cleanupMode
  || createHash("sha256").update(stableJson(profileContent)).digest("hex") !== profileDigest) {
  fail("Repository release profile does not bind the public CI and worktree cleanup policy");
}

const catalog = JSON.parse(await readFile(resolve(root, "site/catalog.json"), "utf8"));
const registryHtml = await readFile(resolve(root, "site/index.html"), "utf8");
verifyContentSecurityPolicy(registryHtml);
assertLocalDevCspFixtures(registryHtml.toString("utf8"));
await assertFloatingPanelOwnerContract(registryHtml);
const registryCss = await readFile(resolve(root, "site/registry.css"), "utf8");
for (const asset of ["graph-profile", "commerce-theme", "shared-ui-profile"]) {
  if (!registryHtml.includes(`<link rel="stylesheet" href="./vendor/${asset}.css">`)) fail(`Registry must load its pinned ${asset} stylesheet`);
}
if (/<style\b|\sstyle\s*=/iu.test(registryHtml) || /(?:^|[;{])\s*(?:--[\w-]+|grid-template-columns|border-radius)\s*:|\.agentic-(?:toolbar|base-floating-panel|floating-panel|dashboard|control|toggle|icon|form|panel|ktv)\b|#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/iu.test(registryCss)) {
  fail("Registry styling must consume the generated palette and dashboard classes without overrides");
}
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
  || !notices.includes("Graph token and typography values\n-------------------------------\nSource: agentic-graph@be87de5c3dcc66f58d2cd1b4d96e5920dd284a46")
  || !notices.includes("User instructions 2026-11-07: centralize design token values and generated projections from the eight listed Graph token sources")) {
  fail("Third-party license notices are incomplete");
}

console.log(`Public release checks passed for ${expectedFiles.length} files.`);

const iconBytes = await readFile(resolve(root, "site/icons.json"));
validateIconLibrary(iconBytes.toString("utf8"));
const iconManifest = JSON.parse(await readFile(resolve(root, "site/catalog.json"), "utf8")).iconLibrary;
if (iconManifest?.digest !== `sha256:${createHash("sha256").update(iconBytes).digest("hex")}`) fail("Central icon digest drift");
