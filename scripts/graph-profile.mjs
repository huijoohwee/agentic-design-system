import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const profilePath = resolve(root, "site/tokens/graph-profile.json");
const outputPath = resolve(root, "site/vendor/graph-profile.css");
const SOURCE_REVISION = "bed770d91a9b3f1b663eee9637a472bf19b36361";
const SOURCE_PATHS = Object.freeze([
  ["grph-shared/src/ui/kgTokens.ts", "sha256:4a8e7e57e011f986cc86d94f5d77d43cea26660627677cd5c0f4ab7fd25bc30e"],
  ["grph-shared/src/ui/typography.ts", "sha256:82d83deb9cba2ae5549069780e028849ee7365d46d97dff2574cdd1a00df8047"],
  ["grph-shared/src/ui/fontStacks.js", "sha256:27fe9d5fb35e866c662a28551162a3451604aea43b93ecaf7ba457cb8c356916"],
  ["canvas/src/styles/kgTokens.generated.css", "sha256:b676d411f7f1683a9b208b2a74f03a921d7e77a32a6f2b4a4274a41c6441dee8"],
]);
const TOKEN_KEY = /^[a-z0-9][a-z0-9.-]{0,95}$/u;
const CSS_VAR = /^--kg-[a-z0-9-]{1,80}$/u;
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
    || profile.version !== "0.1.0" || profile.status !== "candidate" || profile.sourceRevision !== SOURCE_REVISION) fail("identity");
  exactKeys(profile.scope, ["repository", "surfaces"], "scope");
  if (profile.scope.repository !== "github.com/huijoohwee/agentic-graph"
    || JSON.stringify(profile.scope.surfaces) !== JSON.stringify(["graph-ui", "application-typography"])) fail("scope");
  if (!Array.isArray(profile.sources) || profile.sources.length !== SOURCE_PATHS.length
    || JSON.stringify(profile.sources) !== JSON.stringify(SOURCE_PATHS.map(([path, sha256]) => ({ path, sha256 })))) fail("source grant inventory");
  if (profile.permissionEvidence !== "User grant 2026-10-29: public reuse of the exact four Graph artifacts listed here, with attribution, in this central MIT repository; no broader Graph source grant.") fail("permission evidence");
  if (!Array.isArray(profile.tokens) || profile.tokens.length < 50 || profile.tokens.length > 128) fail("token count");
  const keys = new Set();
  const variables = new Set();
  for (const token of profile.tokens) {
    exactKeys(token, ["key", "cssVar", "type", "values"], "token");
    if (!TOKEN_KEY.test(token.key ?? "") || !CSS_VAR.test(token.cssVar ?? "")
      || token.key !== token.cssVar.slice(5) || keys.has(token.key) || variables.has(token.cssVar)) fail(`duplicate or invalid token ${token.key ?? ""}`);
    keys.add(token.key);
    variables.add(token.cssVar);
    if (!["color", "dimension", "shadow", "font-stack", "typography"].includes(token.type)) fail(`token type ${token.key}`);
    exactKeys(token.values, ["light", "dark", "black"], `${token.key} values`);
    if (Object.values(token.values).some(value => typeof value !== "string" || !CSS_VALUE.test(value) || /[{};]|url\s*\(/iu.test(value))) fail(`unsafe CSS value ${token.key}`);
  }
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
  for (const token of profile.tokens) {
    rootRows.push(`  ${token.cssVar}: ${token.values.light};`);
    if (token.values.dark !== token.values.light) darkRows.push(`  ${token.cssVar}: ${token.values.dark};`);
    if (token.values.black !== token.values.dark) blackRows.push(`  ${token.cssVar}: ${token.values.black};`);
  }
  return [
    `/* Generated from agentic-graph@${profile.sourceRevision}; profile sha256 ${profileDigest}. Do not edit. */`,
    ":root {", ...rootRows, "}",
    ...(darkRows.length ? [":root[data-theme='dark'] {", ...darkRows, "}"] : []),
    ...(blackRows.length ? [":root[data-theme='dark'][data-dark-variant='black'] {", ...blackRows, "}"] : []),
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
