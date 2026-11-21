import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const profilePath = resolve(root, "site/tokens/graph-profile.json");
const outputPath = resolve(root, "site/vendor/graph-profile.css");
const SOURCE_REVISION = "746dd7042a23c4b64492026d41a4c2819f477cb9";
const SOURCE_PATHS = Object.freeze([
  [
    "grph-shared/src/ui/kgTokens.ts",
    "sha256:4bec1bee87fd4c1558a61113a604283b890dc7a9bc3d68d7dfee76b67e4c9cb1"
  ],
  [
    "grph-shared/src/ui/typography.ts",
    "sha256:1d522c1bd928fc92c2cf571a257820d0ed71e4028750b173e57a20d187ad43f1"
  ],
  [
    "grph-shared/src/ui/fontStacks.js",
    "sha256:59e970b1be4bad6db260427c8d87f1b7707168cc3f18f3892575072e25f93516"
  ],
  [
    "grph-shared/src/ui/kgTokenContract.ts",
    "sha256:56c5b7761d0f9f7d619e66d722159fa9edd171b1c3b05408716c59c2a7ae5cf1"
  ],
  [
    "grph-shared/src/ui/design-runtime-profile.json",
    "sha256:701630f97347393cc2feea5b2c0aa36b4d224b5c18ebe1e3b1e63b232ddd794a"
  ],
  [
    "grph-shared/src/ui/graph-profile.pin.json",
    "sha256:5c6f9fb8b579c14068bf4c890d580dfb041ce5302567746c3359c59a0628de17"
  ],
  [
    "canvas/src/styles/kgTokens.generated.css",
    "sha256:aeedf2bb331e6d677ba1dcc9c163ed14cdf289169e6a3b44d7caff4975004316"
  ],
  [
    "canvas/src/index.css",
    "sha256:2199adaefc3b7f9ace1201a497861902ce496466eeed60b6a6ef0a536767e086"
  ],
  [
    "canvas/src/styles/shared-borders.css",
    "sha256:6ed4dfd192fd65eca9f1e95e5b6dc0d2e38476c463ccee71e8b6e3b0a9d01d0c"
  ],
  [
    "canvas/src/styles/responsive-toolbar.css",
    "sha256:69c31aa22652b7bffce4203ff0737a3b940e835c4bc3ff4df26b505ce381b369"
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
    || profile.version !== "0.3.0" || profile.status !== "candidate" || profile.sourceRevision !== SOURCE_REVISION) fail("identity");
  exactKeys(profile.scope, ["repository", "surfaces"], "scope");
  if (profile.scope.repository !== "github.com/huijoohwee/agentic-graph"
    || JSON.stringify(profile.scope.surfaces) !== JSON.stringify(["graph-ui", "application-typography"])) fail("scope");
  if (!Array.isArray(profile.sources) || profile.sources.length !== SOURCE_PATHS.length
    || JSON.stringify(profile.sources) !== JSON.stringify(SOURCE_PATHS.map(([path, sha256]) => ({ path, sha256 })))) fail("source grant inventory");
  if (profile.permissionEvidence !== "User instructions 2026-11-07: centralize design token values and generated projections from the eight listed Graph token sources in Agentic Design System, with attribution; no broader Graph source grant. User instruction 2026-11-21: refresh attribution to Graph revision 746dd7042a23c4b64492026d41a4c2819f477cb9 and expand the inventory to eleven paths, adding kgTokenContract.ts, design-runtime-profile.json and graph-profile.pin.json as contract adapters and checked projections of the central profile; token values unchanged.") fail("permission evidence");
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
    '--agentic-control-height', '--agentic-control-height-touch', '--agentic-row-height',
    '--agentic-hover-panel-background', '--agentic-hover-text-color']);
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
    ".agentic-hover-panel {",
    "  --kg-panel-bg: var(--agentic-hover-panel-background);",
    "  --kg-text-primary: var(--agentic-hover-text-color);",
    "  --kg-text-secondary: var(--agentic-hover-label-color);",
    "  --kg-text-tertiary: var(--agentic-hover-label-color);",
    "}",
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
