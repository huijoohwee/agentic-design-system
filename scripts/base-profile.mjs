import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const profilePath = resolve(root, "site/tokens/base-profile.json");
const outputPath = resolve(root, "site/vendor/base-profile.css");
const TOKEN_KEY = /^[a-z][a-z0-9.-]{0,95}$/u;
const CSS_VAR = /^--agentic-base-[a-z0-9-]{1,80}$/u;
const COLOR = /^#[a-f0-9]{6}$/iu;
const DIMENSION = /^(?:0|[0-9]+(?:\.[0-9]+)?)(?:px|rem|em)$/u;
const SOURCE_REVISION = "a5d0f2d87d8c6871e9639f8224f5eaee056c5b6e";
const SOURCE_PATH = "packages/views-react/src/browser/browserDataView.css";
const SOURCE_DIGEST = "sha256:f00b3f4c88dfa81946fdc1577aa01ff49ea3e6f996f32607bc715a5d93079b69";
const EXPECTED_KEYS = Object.freeze([
  "data-view.action-hover",
  "data-view.border",
  "data-view.row-hover",
  "data-view.table-header-bg",
  "data-view.table-sticky-header-bg",
  "data-view.text-primary",
  "data-view.text-secondary",
  "data-view.text-tertiary",
  "data-view.tree-cell-padding-inline",
]);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

function fail(message) {
  throw new Error(`Invalid Base profile: ${message}`);
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) {
    fail(`${label} fields`);
  }
}

function parseProfile(source) {
  const profile = JSON.parse(source);
  exactKeys(profile, ["schema", "id", "version", "status", "scope", "source", "license", "tokens"], "root");
  if (profile.schema !== "agentic-design-system/base-profile/v1" || profile.id !== "base"
    || profile.version !== "0.1.0" || profile.status !== "candidate") fail("identity");
  exactKeys(profile.scope, ["repository", "surfaces"], "scope");
  if (profile.scope.repository !== "github.com/huijoohwee/agentic-base"
    || JSON.stringify(profile.scope.surfaces) !== JSON.stringify(["shared-data-view"])) fail("scope");
  exactKeys(profile.source, ["revision", "path", "digest"], "source");
  if (profile.source.revision !== SOURCE_REVISION || profile.source.path !== SOURCE_PATH
    || profile.source.digest !== SOURCE_DIGEST) fail("source pin");
  exactKeys(profile.license, ["id", "path", "digest"], "license");
  if (profile.license.id !== "MIT" || profile.license.path !== "LICENSE"
    || profile.license.digest !== "sha256:939721e4008a40f28594af8bdd7c122e388d9b22534ef1e6799dc771023691a1") {
    fail("license evidence");
  }
  if (!Array.isArray(profile.tokens) || profile.tokens.length !== EXPECTED_KEYS.length
    || JSON.stringify(profile.tokens.map(token => token?.key)) !== JSON.stringify(EXPECTED_KEYS)) {
    fail("token inventory or order");
  }
  const keys = new Set();
  const variables = new Set();
  for (const token of profile.tokens) {
    if (!TOKEN_KEY.test(token.key ?? "") || !CSS_VAR.test(token.cssVar ?? "")
      || keys.has(token.key) || variables.has(token.cssVar)) fail(`duplicate or invalid token ${token.key ?? ""}`);
    keys.add(token.key);
    variables.add(token.cssVar);
    if (token.type === "color") {
      exactKeys(token, ["key", "cssVar", "type", "value"], token.key);
      if (!COLOR.test(token.value ?? "")) fail(`color value ${token.key}`);
    } else if (token.type === "dimension") {
      exactKeys(token, ["key", "cssVar", "type", "value"], token.key);
      if (!DIMENSION.test(token.value ?? "")) fail(`dimension value ${token.key}`);
    } else if (token.type === "alias") {
      exactKeys(token, ["key", "cssVar", "type", "targetKey"], token.key);
      if (!TOKEN_KEY.test(token.targetKey ?? "") || token.targetKey === token.key) fail(`alias target ${token.key}`);
    } else fail(`token type ${token.key}`);
  }
  for (const token of profile.tokens) {
    if (token.type === "alias" && !keys.has(token.targetKey)) fail(`unknown alias ${token.targetKey}`);
  }
  return profile;
}

export function validateBaseProfile(source) {
  return parseProfile(source);
}

export function renderBaseCss(profile, sourceRevision, profileDigest) {
  if (!/^[a-f0-9]{40}$/u.test(sourceRevision ?? "")
    || !/^[a-f0-9]{64}$/u.test(profileDigest ?? "")) fail("projection binding");
  const byKey = new Map(profile.tokens.map(token => [token.key, token]));
  const rows = [...profile.tokens]
    .sort((left, right) => left.cssVar < right.cssVar ? -1 : left.cssVar > right.cssVar ? 1 : 0)
    .map(token => {
      const value = token.type === "alias"
        ? `var(${byKey.get(token.targetKey).cssVar})`
        : token.value;
      return `  ${token.cssVar}: ${value};`;
    });
  return `/* Generated from agentic-base@${sourceRevision}; profile sha256 ${profileDigest}. Do not edit. */\n:root {\n${rows.join("\n")}\n}\n`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => arg !== "--write")) fail("usage: node scripts/base-profile.mjs [--write]");
  const bytes = await readFile(profilePath);
  const profile = parseProfile(bytes.toString("utf8"));
  const css = renderBaseCss(profile, profile.source.revision, digest(bytes));
  if (args[0] === "--write") {
    await writeFile(outputPath, css, "utf8");
    console.log(`Base projection written: ${profile.tokens.length} tokens; sha256:${digest(Buffer.from(css))}`);
    return;
  }
  process.stdout.write(css);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
