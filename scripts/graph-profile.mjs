import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const profilePath = resolve(root, "site/tokens/graph-profile.json");
const outputPath = resolve(root, "site/vendor/graph-profile.css");
const SOURCE_REVISION = "be87de5c3dcc66f58d2cd1b4d96e5920dd284a46";
const SOURCE_PATHS = Object.freeze([
  [
    "grph-shared/src/ui/kgTokens.ts",
    "sha256:5c8235fe34e79eaeaf92befc7c93200fd4a99e060aa5daa1a9eee689159f86a3"
  ],
  [
    "grph-shared/src/ui/typography.ts",
    "sha256:945db1516136ea3c6a1e06e56a2efbc1e100320b6ce42d860b79024b31707734"
  ],
  [
    "grph-shared/src/ui/fontStacks.js",
    "sha256:cbd531055722036fb0bf7befcd682c8782ad109fe2cd3e7c2ad94fa41d3067ba"
  ],
  [
    "canvas/src/styles/kgTokens.generated.css",
    "sha256:0d6e6689a116c969a354a0ac1353fac9363537a0e4691b379e37c80c36f395f5"
  ],
  [
    "canvas/src/index.css",
    "sha256:57ef092fba4022aaaeb9279d30d3b5d0abd5e2aa1e9e41544b83d04301f8dc5c"
  ],
  [
    "canvas/src/styles/shared-borders.css",
    "sha256:829701ef1acc40dc1dc95de5b5d928d97ac76093bed8bca0b3222ab149a6bdd3"
  ],
  [
    "canvas/src/styles/responsive-toolbar.css",
    "sha256:979e45c2bc7b08f8f802cf231eaf95cdbde44bb8fc0c3db20628254a29f2d72b"
  ],
  [
    "canvas/src/styles/design-system-responsive.css",
    "sha256:9005be75a215bf3eb496cb25034de6d174667599cac58ac34d62deb15ea5f13f"
  ]
]);
const TOKEN_KEY = /^[a-z0-9][a-z0-9.-]{0,95}$/u;
const CSS_VAR = /^--[a-z][a-z0-9-]{1,80}$/u;
const CSS_VALUE = /^[A-Za-z0-9 #.,()_%'/-]{1,240}$/u;
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = message => { throw new Error(`Invalid Graph profile: ${message}`); };

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) fail(`${label} fields`);
}

function parseProfile(source) {
  const profile = JSON.parse(source);
  exactKeys(profile, ["schema", "id", "version", "status", "scope", "sourceRevision", "sources", "permissionEvidence", "tokens"], "root");
  if (profile.schema !== "agentic-design-system/graph-profile/v1" || profile.id !== "graph"
    || profile.version !== "0.2.0" || profile.status !== "candidate" || profile.sourceRevision !== SOURCE_REVISION) fail("identity");
  exactKeys(profile.scope, ["repository", "surfaces"], "scope");
  if (profile.scope.repository !== "github.com/huijoohwee/agentic-graph"
    || JSON.stringify(profile.scope.surfaces) !== JSON.stringify(["graph-ui", "application-typography"])) fail("scope");
  if (!Array.isArray(profile.sources) || profile.sources.length !== SOURCE_PATHS.length
    || JSON.stringify(profile.sources) !== JSON.stringify(SOURCE_PATHS.map(([path, sha256]) => ({ path, sha256 })))) fail("source grant inventory");
  if (profile.permissionEvidence !== "User instructions 2026-11-07: centralize design token values and generated projections from the eight listed Graph token sources in Agentic Design System, with attribution; no broader Graph source grant.") fail("permission evidence");
  if (!Array.isArray(profile.tokens) || profile.tokens.length < 50 || profile.tokens.length > 256) fail("token count");
  const keys = new Set();
  const variables = new Set();
  for (const token of profile.tokens) {
    exactKeys(token, ["key", "cssVar", "type", "values", ...(token.reducedMotion === undefined ? [] : ["reducedMotion"])], "token");
    if (!TOKEN_KEY.test(token.key ?? "") || !CSS_VAR.test(token.cssVar ?? "")
      || token.key !== (token.cssVar.startsWith("--kg-") ? token.cssVar.slice(5) : `legacy.${token.cssVar.slice(2)}`) || keys.has(token.key) || variables.has(token.cssVar)) fail(`duplicate or invalid token ${token.key ?? ""}`);
    keys.add(token.key);
    variables.add(token.cssVar);
    if (!["color", "dimension", "shadow", "font-stack", "typography", "css-value"].includes(token.type)) fail(`token type ${token.key}`);
    exactKeys(token.values, ["light", "dark", "black"], `${token.key} values`);
    if ([...Object.values(token.values), ...(token.reducedMotion === undefined ? [] : [token.reducedMotion])].some(value => typeof value !== "string" || !CSS_VALUE.test(value) || /[{};]|url\s*\(/iu.test(value))) fail(`unsafe CSS value ${token.key}`);
  }
  const known = new Set([...variables, '--agentic-font-sans', '--agentic-font-mono', '--agentic-font-size-body',
    '--agentic-line-height-body', '--agentic-icon-size-compact', '--agentic-icon-size-default',
    '--agentic-control-height', '--agentic-control-height-touch', '--agentic-row-height']);
  const byVar = new Map(profile.tokens.map(token => [token.cssVar, token]));
  const visit = (variable, mode, chain = []) => {
    if (chain.includes(variable) || chain.length > 16) fail(`reference cycle/depth ${variable}`);
    const token = byVar.get(variable);
    if (!token) return;
    const value = mode === 'reduced' ? token.reducedMotion ?? token.values.light : token.values[mode];
    for (const [, target] of value.matchAll(/var\((--[a-z0-9-]+)/gu)) {
      if (!known.has(target)) fail(`unknown reference ${target}`);
      visit(target, mode, [...chain, variable]);
    }
  };
  for (const variable of variables) for (const mode of ['light', 'dark', 'black', 'reduced']) visit(variable, mode);
  return profile;
}

export function validateGraphProfile(source) {
  return parseProfile(source);
}

export function renderGraphCss(profile, profileDigest) {
  if (!/^[a-f0-9]{64}$/u.test(profileDigest ?? "")) fail("profile binding");
  const rootRows = [];
  const darkRows = [];
  const blackRows = [];
  const reducedRows = [];
  for (const token of profile.tokens) {
    if (token.reducedMotion !== undefined) reducedRows.push(`    ${token.cssVar}: ${token.reducedMotion};`);
    rootRows.push(`  ${token.cssVar}: ${token.values.light};`);
    if (token.values.dark !== token.values.light) darkRows.push(`  ${token.cssVar}: ${token.values.dark};`);
    if (token.values.black !== token.values.dark) blackRows.push(`  ${token.cssVar}: ${token.values.black};`);
  }
  return [
    `/* Generated from agentic-design-system Graph profile; origin agentic-graph@${profile.sourceRevision}; profile sha256 ${profileDigest}. Do not edit. */`,
    ":root {", ...rootRows, "}",
    ...(darkRows.length ? [":root[data-theme='dark'] {", ...darkRows, "}"] : []),
    ...(blackRows.length ? [":root[data-theme='dark'][data-dark-variant='black'] {", ...blackRows, "}"] : []),
    ...(reducedRows.length ? ['@media (prefers-reduced-motion: reduce) {', '  :root {', ...reducedRows, '  }', '}'] : []),
    "",
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !["--check", "--write"].includes(arg))) fail("usage: node scripts/graph-profile.mjs [--check|--write]");
  const bytes = await readFile(profilePath);
  const profile = parseProfile(bytes.toString("utf8"));
  const css = renderGraphCss(profile, digest(bytes));
  if (args[0] === "--check") {
    const current = await readFile(outputPath, "utf8");
    if (current !== css) fail("generated CSS projection drift");
    console.log(`Graph profile valid: ${profile.tokens.length} unique keys across light, dark, and black modes; exact-source grant only.`);
    return;
  }
  if (args[0] === "--write") {
    await writeFile(outputPath, css, "utf8");
    console.log(`Graph projection written: ${profile.tokens.length} tokens; sha256:${digest(Buffer.from(css))}`);
    return;
  }
  process.stdout.write(css);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
