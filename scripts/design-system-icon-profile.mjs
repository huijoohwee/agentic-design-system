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
    "dimension"
  ],
  [
    "icon.size.default",
    "--agentic-icon-size-default",
    "dimension"
  ],
  ["icon.stroke-width", "--agentic-icon-stroke-width", "number"],
  [
    "surface.row-height",
    "--agentic-row-height",
    "dimension"
  ],
  [
    "surface.row-height-touch",
    "--agentic-row-height-touch",
    "dimension"
  ],
  [
    "typography.body.size",
    "--agentic-font-size-body",
    "dimension"
  ],
  [
    "typography.body.line-height",
    "--agentic-line-height-body",
    "dimension"
  ],
  [
    "typography.family.sans",
    "--agentic-font-sans",
    "font-family"
  ],
  [
    "typography.family.mono",
    "--agentic-font-mono",
    "font-family"
  ],
  [
    "layout.ktv.columns",
    "--agentic-ktv-columns",
    "grid-template"
  ],
  [
    "layout.ktv.columns-narrow",
    "--agentic-ktv-columns-narrow",
    "grid-template"
  ],
  [
    "layout.ktv.stack-breakpoint",
    "--agentic-ktv-stack-breakpoint",
    "dimension"
  ],
  [
    "layout.ktv.panel-width",
    "--agentic-ktv-panel-width",
    "dimension"
  ],
  [
    "control.height",
    "--agentic-control-height",
    "dimension"
  ],
  [
    "control.height-touch",
    "--agentic-control-height-touch",
    "dimension"
  ],
  [
    "control.padding-inline",
    "--agentic-control-padding-inline",
    "dimension"
  ],
  [
    "control.padding-block",
    "--agentic-control-padding-block",
    "dimension"
  ],
  [
    "control.radius",
    "--agentic-control-radius",
    "dimension"
  ],
  [
    "control.focus-width",
    "--agentic-control-focus-width",
    "dimension"
  ],
  [
    "control.focus-offset",
    "--agentic-control-focus-offset",
    "dimension"
  ],
  [
    "menu.min-width",
    "--agentic-menu-min-width",
    "dimension"
  ],
  [
    "menu.edge-gap",
    "--agentic-menu-edge-gap",
    "dimension"
  ],
  [
    "menu.padding",
    "--agentic-menu-padding",
    "dimension"
  ],
  [
    "menu.gap",
    "--agentic-menu-gap",
    "dimension"
  ]
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
    || profile.version !== "0.7.0" || profile.status !== "candidate") fail("identity");
  exactKeys(profile.scope, ["repository", "surfaces"], "scope");
  if (profile.scope.repository !== "github.com/huijoohwee/agentic-design-system"
    || JSON.stringify(profile.scope.surfaces) !== JSON.stringify(["shared-interface"])) fail("scope");
  if (!Array.isArray(profile.tokens) || profile.tokens.length !== EXPECTED.length
    || JSON.stringify(profile.tokens.map(token => [token?.key, token?.cssVar, token?.type])) !== JSON.stringify(EXPECTED)) fail("token inventory or order");
  const keys = new Set();
  const variables = new Set();
  for (const token of profile.tokens) {
    exactKeys(token, ["key", "cssVar", "type", "value"], token.key ?? "token");
    if (!TOKEN_KEY.test(token.key ?? "") || !CSS_VAR.test(token.cssVar ?? "")
      || (typeof token.value !== "string" || token.value.length > 256
        || token.type === "dimension" && !DIMENSION.test(token.value)
        || token.type === "number" && (!/^[0-9]+(?:\.[0-9]+)?$/u.test(token.value) || Number(token.value) < 0.5 || Number(token.value) > 4)
        || token.type === "font-family" && !/^[A-Za-z0-9 ,._-]+$/u.test(token.value)
        || token.type === "grid-template" && (!/^[A-Za-z0-9()., %-]+$/u.test(token.value) || /url|expression|\b(?:auto|none)\b/iu.test(token.value))) || keys.has(token.key) || variables.has(token.cssVar)) fail(`invalid token ${token.key ?? ""}`);
    keys.add(token.key);
    variables.add(token.cssVar);
  }

  return profile;
}

export function renderSharedUiCss(profile, sourceRevision, profileDigest) {
  if (!/^[a-f0-9]{40}$/u.test(sourceRevision ?? "") || !/^[a-f0-9]{64}$/u.test(profileDigest ?? "")) fail("projection binding");
  const declarations = profile.tokens.map(token => `  ${token.cssVar}: ${token.value};`);
  const input = 'input:not([type="hidden"], [type="file"], [type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="button"], [type="submit"], [type="reset"], [type="image"], [hidden], .sr-only, .file-input)';
  const nativeField = `:is(.agentic-form-controls :where(${input}, select, textarea), .agentic-input-controls :where(${input}, select))`;
  const field = `.agentic-form-control, ${nativeField}`;
  return `/* Generated from agentic-design-system@${sourceRevision}; profile sha256 ${profileDigest}. Do not edit. */
:root, :host {
${declarations.join("\n")}
}
.agentic-toggle-group {
  box-sizing: border-box; display: inline-flex; align-items: stretch;
  min-inline-size: 0; max-inline-size: 100%; block-size: var(--agentic-control-height); overflow-x: auto;
  scrollbar-width: none; border: 1px solid var(--agentic-base-border, var(--kg-border, ButtonBorder));
  border-radius: var(--agentic-control-radius); background: var(--agentic-base-surface, var(--kg-panel-bg, Canvas));
  color: var(--agentic-base-muted, var(--kg-text-secondary, CanvasText));
  font: 500 var(--kg-text-xs, .75rem)/var(--kg-text-xs-line, 1rem) var(--agentic-font-sans);
}
.agentic-toggle-group > button {
  display: inline-flex; flex: none; align-items: center; justify-content: center; gap: var(--agentic-control-padding-block);
  margin: 0; padding: 0 var(--agentic-control-padding-inline); border: 0; border-radius: 0;
  background: transparent; color: inherit; font: inherit; white-space: nowrap; cursor: pointer;
}
.agentic-toggle-group > button:enabled:hover { background: var(--agentic-base-hover, var(--kg-panel-action-bg-hover, color-mix(in srgb, currentColor 6%, transparent))); }
.agentic-toggle-group > button[aria-pressed="true"] { background: color-mix(in srgb, currentColor 15%, transparent); }
.agentic-toggle-group > button:focus-visible { outline: var(--agentic-control-focus-width) solid var(--agentic-control-focus, Highlight); outline-offset: calc(-1 * var(--agentic-control-focus-width)); }
.agentic-toggle-group > button:disabled { opacity: .5; cursor: not-allowed; }
@media (forced-colors: active) {
  .agentic-toggle-group > button[aria-pressed="true"] { color: HighlightText; background: Highlight; forced-color-adjust: none; }
}
.agentic-checkbox-group {
  display: inline-flex; align-items: center; gap: var(--agentic-control-padding-block);
  min-inline-size: 0; max-inline-size: 100%; overflow-x: auto;
  margin: 0; padding: 0; border: 0;
  font: var(--agentic-font-size-body)/var(--agentic-line-height-body) var(--agentic-font-sans);
}
.agentic-checkbox-group > label {
  display: inline-flex; flex: none; align-items: center; gap: var(--agentic-control-padding-block);
  box-sizing: border-box; min-block-size: var(--agentic-control-height); padding-inline: var(--agentic-control-padding-block);
  margin: 0; white-space: nowrap; font: inherit; cursor: pointer;
}
.agentic-checkbox-group > label:has(:disabled) { opacity: .5; cursor: not-allowed; }
.agentic-checkbox-group > label > input[type="checkbox"] {
  flex: none; inline-size: var(--agentic-icon-size-default); block-size: var(--agentic-icon-size-default);
  min-inline-size: 0; min-block-size: 0; margin: 0; padding: 0; cursor: inherit;
}
.agentic-panel-section { box-sizing: border-box; min-inline-size: 0; max-inline-size: 100%; padding-inline: calc(var(--agentic-control-padding-inline) + var(--agentic-control-padding-block)); }
.agentic-panel-section-header { box-sizing: border-box; display: flex; min-inline-size: 0; max-inline-size: 100%; min-block-size: var(--agentic-row-height); align-items: center; justify-content: space-between; gap: var(--agentic-control-padding-block); padding-inline: var(--agentic-control-padding-inline); font: var(--agentic-font-size-body)/var(--agentic-line-height-body) var(--agentic-font-sans); }
.agentic-panel-section-title { min-inline-size: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.agentic-panel-section-actions { display: flex; flex: 0 0 auto; flex-wrap: wrap; align-items: center; justify-content: end; gap: var(--agentic-control-padding-block); }
.agentic-panel-section-body { min-inline-size: 0; max-inline-size: 100%; padding-inline: calc(var(--agentic-control-padding-inline) + var(--agentic-control-padding-block)); padding-block: var(--agentic-control-padding-inline); }
.agentic-panel-section :is(.agentic-panel-section, .agentic-panel-section-body) { padding-inline: 0; }
.agentic-panel-section-body > :not([hidden]) ~ :not([hidden]) { margin-block-start: var(--agentic-control-padding-inline); }
.agentic-ktv-container { min-inline-size: 0; inline-size: 100%; container: agentic-ktv / inline-size; }
.agentic-ktv-row { display: grid; grid-template-columns: var(--agentic-ktv-columns); gap: 0 var(--agentic-control-padding-inline); min-inline-size: 0; max-inline-size: 100%; inline-size: 100%; align-items: center; padding-block: var(--agentic-control-padding-block); font: var(--agentic-font-size-body)/var(--agentic-line-height-body) var(--agentic-font-sans); }
.agentic-ktv-row[data-align="start"] { align-items: start; }
.agentic-ktv-row > :is(dt, dd) { display: flex; align-items: center; min-inline-size: 0; max-inline-size: 100%; margin: 0; padding-inline: var(--agentic-control-padding-inline); overflow: hidden; }
.agentic-ktv-key { white-space: nowrap; text-overflow: ellipsis; }
.agentic-ktv-type { justify-content: center; }
.agentic-ktv-value { min-block-size: var(--agentic-control-height); justify-content: end; align-self: stretch; gap: var(--agentic-control-padding-block); }
.agentic-ktv-value > * { min-inline-size: 0; max-inline-size: 100%; }
.agentic-icon { display: block; flex: 0 0 auto; inline-size: var(--agentic-icon-size-default); block-size: var(--agentic-icon-size-default); stroke-width: var(--agentic-icon-stroke-width); }
.agentic-icon-compact { inline-size: var(--agentic-icon-size-compact); block-size: var(--agentic-icon-size-compact); }
.agentic-icon-color { color: var(--agentic-base-muted, var(--kg-text-secondary, CanvasText)); }
.agentic-icon-hover:is(:hover, :focus-visible) { background: var(--agentic-base-hover, var(--kg-panel-action-bg-hover, Canvas)); }
.agentic-icon-padding { padding: var(--agentic-control-padding-block); }
.agentic-icon-pill, .agentic-icon-badge { display: inline-flex; align-items: center; justify-content: center; gap: var(--agentic-control-padding-block); min-inline-size: 0; max-inline-size: 100%; box-sizing: border-box; min-block-size: var(--agentic-control-height); padding: 0 var(--agentic-control-padding-inline); border: 1px solid var(--agentic-base-border, var(--kg-border, ButtonBorder)); border-radius: var(--agentic-control-radius); white-space: nowrap; }
.agentic-icon-text, .agentic-icon-pill, .agentic-icon-badge { font: var(--agentic-font-size-body)/var(--agentic-line-height-body) var(--agentic-font-sans); }
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
.agentic-menu {
  box-sizing: border-box; margin: 0; padding: var(--agentic-menu-padding); list-style: none;
  display: flex; flex-direction: column; gap: var(--agentic-menu-gap); min-inline-size: 0;
  color: var(--agentic-base-text, var(--kg-text-primary, CanvasText));
  background: var(--agentic-base-surface, var(--kg-panel-bg, Canvas));
  border: 1px solid var(--agentic-base-border, var(--kg-border, ButtonBorder));
  border-radius: var(--agentic-control-radius); box-shadow: var(--kg-shadow-overlay, 0 8px 24px rgb(0 0 0 / .12));
  font: var(--agentic-font-size-body)/var(--agentic-line-height-body) var(--agentic-font-sans);
  max-block-size: calc(100dvh - var(--agentic-menu-edge-gap) - var(--agentic-menu-edge-gap));
  overflow: auto; overscroll-behavior: contain;
}
.agentic-menu > li { list-style: none; min-inline-size: 0; }
.agentic-menu-option {
  box-sizing: border-box; display: flex; align-items: center; gap: var(--agentic-control-padding-inline);
  inline-size: 100%; text-align: start; cursor: pointer;
  border: 1px solid transparent; color: inherit; background: transparent;
}
.agentic-menu-option:is(:hover, :focus-visible) { background: var(--agentic-base-hover, var(--kg-panel-action-bg-hover, color-mix(in srgb, Highlight 8%, Canvas))); }
.agentic-menu-option:is([aria-checked="true"], [aria-selected="true"], [data-selected="true"], .agentic-menu-selected) {
  color: var(--kg-accent, LinkText); background: var(--agentic-base-selected, var(--kg-accent-soft-bg, color-mix(in srgb, Highlight 12%, Canvas)));
  border-color: var(--agentic-base-focus, var(--kg-accent, Highlight));
}
.agentic-menu-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-inline-size: 0; }
.agentic-menu-mark { inline-size: var(--agentic-icon-size-default); flex: 0 0 auto; text-align: center; }
.agentic-select-source { display: none !important; }
.agentic-select-trigger { border: 1px solid var(--agentic-base-border, var(--kg-border, ButtonBorder)); background: var(--agentic-base-surface, var(--kg-panel-bg, Canvas)); color: inherit; display: inline-flex; align-items: center; gap: var(--agentic-control-padding-inline); inline-size: 100%; text-align: start; }
.agentic-menu-popup { position: fixed; z-index: 2147483000; }
@media (pointer: coarse), (max-width: 768px) {
  :root, :host { --agentic-row-height: var(--agentic-row-height-touch); --agentic-control-height: var(--agentic-control-height-touch); }
}
`;

}

export function validateIconLibrary(source) {
  const library = JSON.parse(source);
  exactKeys(library, ["schema", "version", "owner", "source", "viewBox", "icons"], "icon library");
  if (library.schema !== "agentic-design-system/icon-library/v1" || library.version !== "1.0.0"
    || library.owner !== "github.com/huijoohwee/agentic-design-system" || library.viewBox !== "0 0 24 24") fail("icon identity");
  exactKeys(library.source, ["package", "version", "license", "licenseSha256"], "icon source");
  if (library.source.package !== "lucide-react" || library.source.version !== "0.562.0"
    || library.source.license !== "ISC AND MIT" || !/^[a-f0-9]{64}$/u.test(library.source.licenseSha256)) fail("icon rights");
  if (!library.icons || typeof library.icons !== "object" || Array.isArray(library.icons)
    || Object.keys(library.icons).length < 1 || Object.keys(library.icons).length > 128) fail("icon inventory");
  const geometries = new Set();
  for (const [name, nodes] of Object.entries(library.icons)) {
    if (!/^[A-Z][A-Za-z0-9]{0,47}$/u.test(name) || !Array.isArray(nodes) || !nodes.length || nodes.length > 32) fail("icon name/nodes");
    const geometry = JSON.stringify(nodes);
    if (geometries.has(geometry)) fail(`duplicate icon artwork: ${name}`);
    geometries.add(geometry);
    for (const node of nodes) {
      if (!Array.isArray(node) || node.length !== 2 || !["path", "line", "polyline", "polygon", "circle", "ellipse", "rect"].includes(node[0])) fail("icon node");
      if (!node[1] || typeof node[1] !== "object" || Array.isArray(node[1]) || !Object.keys(node[1]).length) fail("icon attributes");
      for (const [key, value] of Object.entries(node[1])) {
        if (!["d", "points", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "fill"].includes(key)
          || typeof value !== "string" || !value.length || value.length > 2048
          || !(key === "fill" ? /^(?:none|currentColor)$/u : key === "d" ? /^[MmLlHhVvCcSsQqTtAaZz0-9., +eE-]+$/u : /^[0-9., +eE-]+$/u).test(value)) fail(`unsafe icon attribute: ${name}.${key}`);
      }
    }
  }
  return library;
}

async function main() {
  validateIconLibrary(await readFile(resolve(root, "site/icons.json"), "utf8"));
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
