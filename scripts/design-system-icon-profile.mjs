import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const profilePath = resolve(root, "site/tokens/shared-ui-profile.json");
const outputPath = resolve(root, "site/vendor/shared-ui-profile.css");
const TOKEN_KEY = /^[a-z][a-z0-9.-]{0,95}$/u;
const CSS_VAR = /^--agentic-[a-z0-9-]{1,64}$/u;
const DIMENSION = /^(?:0|[0-9]+(?:\.[0-9]+)?)(?:px|rem|em)$/u;
// Closed inventory: CSS values are validated before projection.
const EXPECTED = Object.freeze([
  [
    "icon.size.compact",
    "--agentic-icon-size-compact",
    "dimension",
    "0.75rem"
  ],
  [
    "icon.size.default",
    "--agentic-icon-size-default",
    "dimension",
    "1rem"
  ],
  [
    "surface.row-height",
    "--agentic-row-height",
    "dimension",
    "38px"
  ],
  [
    "surface.row-height-touch",
    "--agentic-row-height-touch",
    "dimension",
    "54px"
  ],
  [
    "typography.body.size",
    "--agentic-font-size-body",
    "dimension",
    "0.875rem"
  ],
  [
    "typography.body.line-height",
    "--agentic-line-height-body",
    "dimension",
    "1.25rem"
  ],
  [
    "typography.family.sans",
    "--agentic-font-sans",
    "font-family",
    "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji"
  ],
  [
    "typography.family.mono",
    "--agentic-font-mono",
    "font-family",
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace"
  ],
  [
    "layout.ktv.columns",
    "--agentic-ktv-columns",
    "grid-template",
    "minmax(10.5rem,11rem) 2rem minmax(8.75rem,1fr)"
  ],
  [
    "layout.ktv.columns-narrow",
    "--agentic-ktv-columns-narrow",
    "grid-template",
    "minmax(0,1fr) 2rem"
  ],
  ["layout.ktv.stack-breakpoint", "--agentic-ktv-stack-breakpoint", "dimension", "22.25rem"],
  ["layout.ktv.panel-width", "--agentic-ktv-panel-width", "dimension", "26.25rem"],
  ["control.height", "--agentic-control-height", "dimension", "28px"],
  ["control.height-touch", "--agentic-control-height-touch", "dimension", "48px"],
  ["control.padding-inline", "--agentic-control-padding-inline", "dimension", "0.5rem"],
  ["control.padding-block", "--agentic-control-padding-block", "dimension", "0.25rem"],
  ["control.radius", "--agentic-control-radius", "dimension", "0.375rem"],
  ["control.focus-width", "--agentic-control-focus-width", "dimension", "2px"],
  ["control.focus-offset", "--agentic-control-focus-offset", "dimension", "2px"]
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
    || profile.version !== "0.5.0" || profile.status !== "candidate") fail("identity");
  exactKeys(profile.scope, ["repository", "surfaces"], "scope");
  if (profile.scope.repository !== "github.com/huijoohwee/agentic-design-system"
    || JSON.stringify(profile.scope.surfaces) !== JSON.stringify(["shared-interface"])) fail("scope");
  if (!Array.isArray(profile.tokens) || profile.tokens.length !== EXPECTED.length
    || JSON.stringify(profile.tokens.map(token => [token?.key, token?.cssVar, token?.type, token?.value])) !== JSON.stringify(EXPECTED)) fail("token inventory or order");
  const keys = new Set();
  const variables = new Set();
  for (const token of profile.tokens) {
    exactKeys(token, ["key", "cssVar", "type", "value"], token.key ?? "token");
    if (!TOKEN_KEY.test(token.key ?? "") || !CSS_VAR.test(token.cssVar ?? "")
      || (token.type === "dimension" && !DIMENSION.test(token.value ?? "")) || keys.has(token.key) || variables.has(token.cssVar)) fail(`invalid token ${token.key ?? ""}`);
    keys.add(token.key);
    variables.add(token.cssVar);
  }
  if (profile.tokens[0].value !== "0.75rem" || profile.tokens[1].value !== "1rem" || profile.tokens[2].value !== "38px" || profile.tokens[3].value !== "54px") fail("selected shared-size values");
  return profile;
}

export function renderSharedUiCss(profile, sourceRevision, profileDigest) {
  if (!/^[a-f0-9]{40}$/u.test(sourceRevision ?? "") || !/^[a-f0-9]{64}$/u.test(profileDigest ?? "")) fail("projection binding");
  const declarations = profile.tokens.map(token => `  ${token.cssVar}: ${token.value};`);
  const nativeField = '.agentic-form-controls :where(input:not([type="hidden"], [type="file"], [type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="button"], [type="submit"], [type="reset"], [type="image"], [hidden], .sr-only, .file-input), select, textarea)';
  const field = `.agentic-form-control, ${nativeField}`;
  return `/* Generated from agentic-design-system@${sourceRevision}; profile sha256 ${profileDigest}. Do not edit. */
:root, :host {
${declarations.join("\n")}
}
.agentic-ktv-container { min-inline-size: 0; inline-size: 100%; container: agentic-ktv / inline-size; }
@container agentic-ktv (width < ${profile.tokens.find(token => token.key === "layout.ktv.stack-breakpoint").value}) {
  .agentic-ktv-row { grid-template-columns: var(--agentic-ktv-columns-narrow); }
  .agentic-ktv-row > :last-child { grid-column: 1 / -1; }
}
${field} {
  box-sizing: border-box; min-inline-size: 0; max-inline-size: 100%;
  block-size: var(--agentic-control-height); min-block-size: var(--agentic-control-height);
  padding-block: 0; padding-inline: var(--agentic-control-padding-inline); border-radius: var(--agentic-control-radius);
  font-family: var(--agentic-font-sans); font-size: var(--agentic-font-size-body); line-height: var(--agentic-line-height-body);
}
textarea.agentic-form-control, .agentic-form-controls :where(textarea) {
  block-size: auto; padding-block: var(--agentic-control-padding-block); resize: vertical;
}
.agentic-form-control:focus-visible, ${nativeField}:focus-visible {
  outline: var(--agentic-control-focus-width) solid var(--agentic-control-focus, Highlight); outline-offset: var(--agentic-control-focus-offset);
}
.agentic-form-control:disabled, .agentic-form-control[aria-disabled="true"], ${nativeField}:disabled {
  opacity: .5; cursor: not-allowed;
}
@media (pointer: coarse), (max-width: 768px) {
  :root, :host { --agentic-row-height: var(--agentic-row-height-touch); --agentic-control-height: var(--agentic-control-height-touch); }
}
`;

}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !["--validate", "--check", "--write"].includes(arg))) fail("usage: node scripts/shared-ui-profile.mjs [--validate|--check|--write]");
  const bytes = await readFile(profilePath);
  const profile = validateSharedUiProfile(bytes.toString("utf8"));
  if (args[0] === "--validate") {
    console.log(`Shared UI profile valid: ${profile.tokens.length} canonical shared UI tokens.`);
    return;
  }
  const catalog = JSON.parse(await readFile(resolve(root, "site/catalog.json"), "utf8"));
  const ref = catalog.registry?.profiles?.find(item => item.id === profile.id);
  if (!ref || `sha256:${digest(bytes)}` !== ref.digest) fail("catalog source pin");
  const css = renderSharedUiCss(profile, ref.revision, digest(bytes));
  if (args[0] === "--check") {
    const output = await readFile(outputPath, "utf8");
    if (output !== css || `sha256:${digest(Buffer.from(output))}` !== ref.projection?.digest) fail("generated projection drift");
    console.log(`Shared UI projection valid: ${profile.tokens.length} pinned shared UI tokens.`);
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
