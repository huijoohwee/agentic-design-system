import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const profilePath = resolve(root, "site/tokens/shared-ui-profile.json");
const outputPath = resolve(root, "site/vendor/shared-ui-profile.css");
const TOKEN_KEY = /^[a-z][a-z0-9.-]{0,95}$/u;
const CSS_VAR = /^--agentic-icon-size-[a-z0-9-]{1,48}$/u;
const DIMENSION = /^(?:0|[0-9]+(?:\.[0-9]+)?)(?:px|rem|em)$/u;
const EXPECTED = Object.freeze([
  ["icon.size.compact", "--agentic-icon-size-compact"],
  ["icon.size.default", "--agentic-icon-size-default"],
]);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = message => { throw new Error(`Invalid shared UI profile: ${message}`); };

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) fail(`${label} fields`);
}

export function validateSharedUiProfile(source) {
  const profile = JSON.parse(source);
  exactKeys(profile, ["schema", "id", "version", "status", "scope", "tokens"], "root");
  if (profile.schema !== "agentic-design-system/shared-ui-profile/v1" || profile.id !== "shared-ui"
    || profile.version !== "0.1.0" || profile.status !== "candidate") fail("identity");
  exactKeys(profile.scope, ["repository", "surfaces"], "scope");
  if (profile.scope.repository !== "github.com/huijoohwee/agentic-design-system"
    || JSON.stringify(profile.scope.surfaces) !== JSON.stringify(["shared-interface"])) fail("scope");
  if (!Array.isArray(profile.tokens) || profile.tokens.length !== EXPECTED.length
    || JSON.stringify(profile.tokens.map(token => [token?.key, token?.cssVar])) !== JSON.stringify(EXPECTED)) fail("token inventory or order");
  const keys = new Set();
  const variables = new Set();
  for (const token of profile.tokens) {
    exactKeys(token, ["key", "cssVar", "type", "value"], token.key ?? "token");
    if (!TOKEN_KEY.test(token.key ?? "") || !CSS_VAR.test(token.cssVar ?? "") || token.type !== "dimension"
      || !DIMENSION.test(token.value ?? "") || keys.has(token.key) || variables.has(token.cssVar)) fail(`invalid token ${token.key ?? ""}`);
    keys.add(token.key);
    variables.add(token.cssVar);
  }
  if (profile.tokens[0].value !== "0.75rem" || profile.tokens[1].value !== "1rem") fail("selected shared-size values");
  return profile;
}

export function renderSharedUiCss(profile, sourceRevision, profileDigest) {
  if (!/^[a-f0-9]{40}$/u.test(sourceRevision ?? "") || !/^[a-f0-9]{64}$/u.test(profileDigest ?? "")) fail("projection binding");
  const declarations = profile.tokens.map(token => `  ${token.cssVar}: ${token.value};`);
  return `/* Generated from agentic-design-system@${sourceRevision}; profile sha256 ${profileDigest}. Do not edit. */\n:root, :host {\n${declarations.join("\n")}\n}\n`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !["--validate", "--check", "--write"].includes(arg))) fail("usage: node scripts/shared-ui-profile.mjs [--validate|--check|--write]");
  const bytes = await readFile(profilePath);
  const profile = validateSharedUiProfile(bytes.toString("utf8"));
  if (args[0] === "--validate") {
    console.log(`Shared UI profile valid: ${profile.tokens.length} canonical icon-size tokens.`);
    return;
  }
  const catalog = JSON.parse(await readFile(resolve(root, "site/catalog.json"), "utf8"));
  const ref = catalog.registry?.profiles?.find(item => item.id === profile.id);
  if (!ref || `sha256:${digest(bytes)}` !== ref.digest) fail("catalog source pin");
  const css = renderSharedUiCss(profile, ref.revision, digest(bytes));
  if (args[0] === "--check") {
    const output = await readFile(outputPath, "utf8");
    if (output !== css || `sha256:${digest(Buffer.from(output))}` !== ref.projection?.digest) fail("generated projection drift");
    console.log(`Shared UI projection valid: ${profile.tokens.length} pinned icon-size tokens.`);
    return;
  }
  if (args[0] === "--write") {
    await writeFile(outputPath, css, "utf8");
    console.log(`Shared UI projection written: ${profile.tokens.length} tokens; sha256:${digest(Buffer.from(css))}`);
    return;
  }
  process.stdout.write(css);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
