import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const profilePath = resolve(root, "site/tokens/commerce-profile.json");
const tokenKey = /^[a-z][a-z0-9.-]{0,95}$/u;
const cssVar = /^--commerce-[a-z0-9-]{1,80}$/u;
const color = /^#[a-f0-9]{6}$/iu;
const dimension = /^(?:0|[0-9]+(?:\.[0-9]+)?)(?:px|rem|em)$/u;
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = message => { throw new Error(`Invalid Commerce profile: ${message}`); };

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) fail(`${label} fields`);
}

function parseProfile(source) {
  const profile = JSON.parse(source);
  exactKeys(profile, ["schema", "id", "version", "status", "scope", "componentOwner", "iconOwner", "iconRoles", "tokens"], "root");
  if (profile.schema !== "agentic-design-system/commerce-profile/v1" || profile.id !== "commerce"
    || !/^\d+\.\d+\.\d+$/u.test(profile.version) || profile.status !== "candidate") fail("identity");
  exactKeys(profile.scope, ["repository", "surfaces"], "scope");
  if (profile.scope.repository !== "github.com/huijoohwee/agentic-commerce-os"
    || JSON.stringify(profile.scope.surfaces) !== JSON.stringify(["shop", "vendor", "admin", "sme-business-pack"])) fail("scope");
  if (profile.componentOwner !== "github.com/huijoohwee/agentic-commerce-os/public/local-first/workspace-shell.css"
    || profile.iconOwner !== "github.com/huijoohwee/agentic-commerce-os/public/local-first/index.html") fail("owner");
  if (!Array.isArray(profile.iconRoles) || profile.iconRoles.length === 0
    || profile.iconRoles.some(key => !/^commerce\.icon\.[a-z][a-z0-9.-]*$/u.test(key))
    || new Set(profile.iconRoles).size !== profile.iconRoles.length
    || JSON.stringify(profile.iconRoles) !== JSON.stringify([...profile.iconRoles].sort())) fail("icon roles");
  if (!Array.isArray(profile.tokens) || profile.tokens.length < 20 || profile.tokens.length > 128) fail("token count");
  const keys = new Set(), vars = new Set();
  for (const token of profile.tokens) {
    if (!token || typeof token !== "object" || Array.isArray(token)) fail("token record");
    if (!tokenKey.test(token.key ?? "") || !cssVar.test(token.cssVar ?? "") || keys.has(token.key) || vars.has(token.cssVar)) fail(`duplicate or invalid token ${token.key ?? ""}`);
    keys.add(token.key); vars.add(token.cssVar);
    if (token.type === "color") {
      exactKeys(token, token.deriveRgb ? ["key", "cssVar", "type", "value", "deriveRgb"] : ["key", "cssVar", "type", "value"], token.key);
      if (!color.test(token.value) || token.deriveRgb !== undefined && token.deriveRgb !== true) fail(`color value ${token.key}`);
    } else if (token.type === "dimension") {
      exactKeys(token, ["key", "cssVar", "type", "value"], token.key);
      if (!dimension.test(token.value)) fail(`dimension value ${token.key}`);
    } else if (token.type === "alias") {
      exactKeys(token, ["key", "cssVar", "type", "targetKey"], token.key);
      if (!tokenKey.test(token.targetKey ?? "") || token.targetKey === token.key) fail(`alias target ${token.key}`);
    } else if (token.type === "outline") {
      exactKeys(token, ["key", "cssVar", "type", "width", "style", "colorKey"], token.key);
      if (!dimension.test(token.width ?? "") || !["solid", "dashed"].includes(token.style)
        || !tokenKey.test(token.colorKey ?? "")) fail(`outline value ${token.key}`);
    } else if (token.type === "font-stack") {
      exactKeys(token, ["key", "cssVar", "type", "value"], token.key);
      if (typeof token.value !== "string" || !/^[A-Za-z0-9 ,"-]{1,200}$/u.test(token.value)) fail(`font stack ${token.key}`);
    } else if (token.type === "shadow") {
      exactKeys(token, ["key", "cssVar", "type", "value"], token.key);
      if (typeof token.value !== "string" || !/^[0-9 .a-z(),/%-]{1,160}$/u.test(token.value)
        || /url\s*\(|[{};]/iu.test(token.value)) fail(`shadow value ${token.key}`);
    } else fail(`token type ${token.key}`);
  }
  for (const token of profile.tokens) {
    if (token.type === "alias" && !keys.has(token.targetKey)) fail(`unknown alias ${token.targetKey}`);
    if (token.type === "outline" && !keys.has(token.colorKey)) fail(`unknown outline color ${token.colorKey}`);
  }
  const values = new Map(profile.tokens.map(token => [token.key, token]));
  for (const token of profile.tokens.filter(item => item.type === "alias")) {
    const seen = new Set([token.key]); let current = values.get(token.targetKey);
    while (current?.type === "alias") {
      if (seen.has(current.key)) fail(`alias cycle ${token.key}`);
      seen.add(current.key); current = values.get(current.targetKey);
    }
  }
  return profile;
}

export function validateCommerceProfile(source) {
  return parseProfile(source);
}

function hexRgb(value) {
  return [1, 3, 5].map(index => Number.parseInt(value.slice(index, index + 2), 16)).join(" ");
}

export function renderCommerceCss(profile, sourceRevision, profileDigest) {
  if (!/^[a-f0-9]{40}$/u.test(sourceRevision ?? "") || !/^[a-f0-9]{64}$/u.test(profileDigest ?? "")) fail("source binding");
  const byKey = new Map(profile.tokens.map(token => [token.key, token]));
  const rows = [];
  for (const token of [...profile.tokens].sort((left, right) => left.cssVar < right.cssVar ? -1 : left.cssVar > right.cssVar ? 1 : 0)) {
    let value = token.value;
    if (token.type === "alias") value = `var(${byKey.get(token.targetKey).cssVar})`;
    if (token.type === "outline") value = `${token.width} ${token.style} var(${byKey.get(token.colorKey).cssVar})`;
    rows.push(`  ${token.cssVar}: ${value};`);
    if (token.deriveRgb) rows.push(`  ${token.cssVar}-rgb: ${hexRgb(token.value)};`);
  }
  return `/* Generated from agentic-design-system ${sourceRevision}; profile sha256 ${profileDigest}. Do not edit. */\n:root {\n  color-scheme: light;\n${rows.join("\n")}\n  font-family: var(--commerce-font-family);\n  font-synthesis: none;\n}\n`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !["--check", "--css"].includes(arg))) fail("usage: node scripts/commerce-profile.mjs [--check|--css]");
  const bytes = await readFile(profilePath);
  const profile = parseProfile(bytes.toString("utf8"));
  if (args[0] === "--check") {
    console.log(`Commerce profile valid: ${profile.tokens.length} unique tokens, ${profile.iconRoles.length} semantic icon roles; not a released catalog entry.`);
    return;
  }
  const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  process.stdout.write(renderCommerceCss(profile, sourceRevision, digest(bytes)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
