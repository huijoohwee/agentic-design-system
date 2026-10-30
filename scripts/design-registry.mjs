import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCommerceCss, validateCommerceProfile } from "./commerce-profile.mjs";
import { renderBaseCss, validateBaseProfile } from "./base-profile.mjs";
import { renderGraphCss, validateGraphProfile } from "./graph-profile.mjs";
import {
  getRegistryRecord,
  invokeRegistryTool,
  REGISTRY_TOOL_DEFINITIONS,
  registerWebMcpTools,
  searchRegistry,
  validateRegistryContext,
} from "../site/registry-query.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const catalogPath = resolve(root, "site/catalog.json");
const ownerIds = ["agentic-os", "agentic-commerce-os", "agentic-graph", "agentic-base"];
const keyPattern = /^[a-z0-9][a-z0-9.-]*(?::[a-z0-9][a-z0-9.-]*)*$/u;
const variablePattern = /^--[a-z][a-z0-9-]*$/u;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = message => { throw new Error(`Design registry invalid: ${message}`); };
const MCP_PROTOCOL_VERSION = "2025-11-25";
const MAX_MCP_MESSAGE_BYTES = 65_536;

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) fail(`${label} fields`);
}

function uniqueRows(rows, field, label) {
  const seen = new Map();
  for (const row of rows) {
    const value = row[field];
    if (seen.has(value)) fail(`duplicate ${label} ${value} at ${seen.get(value)} and ${row.location}`);
    seen.set(value, row.location);
  }
}

function assertNoOverrides(claims, declarations) {
  const byVariable = new Map(claims.map(claim => [claim.cssVar, claim]));
  for (const declaration of declarations) {
    const claim = byVariable.get(declaration.cssVar);
    if (claim && declaration.path !== claim.ownerPath && declaration.path !== claim.projectionPath) {
      fail(`override ${claim.canonicalKey} (${claim.cssVar}) owned at ${claim.ownerPath}; redeclared at ${declaration.path}:${declaration.line}`);
    }
  }
}

function assertFailClosedChecks() {
  const claim = { canonicalKey: "commerce.color.action", cssVar: "--commerce-action", ownerPath: "site/tokens/commerce-profile.json", location: "fixture:owner" };
  const mustReject = (operation, label) => {
    try { operation(); } catch { return; }
    fail(`${label} guard did not fail closed`);
  };
  mustReject(() => uniqueRows([claim, { ...claim, location: "fixture:duplicate" }], "canonicalKey", "canonical key"), "duplicate key");
  mustReject(() => uniqueRows([claim, { ...claim, canonicalKey: "commerce.color.primary", location: "fixture:variable" }], "cssVar", "CSS variable"), "duplicate CSS variable");
  mustReject(() => assertNoOverrides([claim], [{ cssVar: claim.cssVar, path: "consumer.css", line: 4 }]), "override");
  mustReject(() => assertPublicRights({ rights: "review-required", licenseEvidence: [] }), "rights-pending public profile");
  mustReject(() => assertPublicRights({ rights: "cleared", licenseEvidence: [{}], permissionEvidence: "specific permission evidence" }), "incomplete rights evidence");
}

function assertPublicRights(profile) {
  const validLicense = row => row && typeof row.repository === "string" && /^[a-f0-9]{40}$/u.test(row.revision ?? "")
    && row.path === "LICENSE" && /^sha256:[a-f0-9]{64}$/u.test(row.digest ?? "");
  if (!["cleared", "cleared-scoped"].includes(profile.rights) || !Array.isArray(profile.licenseEvidence)
    || profile.licenseEvidence.length < 1 || profile.licenseEvidence.some(row => !validLicense(row))
    || !hasPermissionEvidence(profile.permissionEvidence)) {
    fail("public profile rights are not proven");
  }
}

function hasPermissionEvidence(value) {
  return typeof value === "string" && value.length >= 20;
}

async function loadRegistryContext() {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const profiles = await Promise.all((catalog.registry?.profiles ?? []).map(async profileRef => {
    if (typeof profileRef.source !== "string" || !profileRef.source.startsWith("./tokens/")) fail("local registry profile reference is invalid");
    const profileBytes = await readFile(resolve(root, "site", profileRef.source.slice(2)));
    if (`sha256:${sha(profileBytes)}` !== profileRef.digest) fail(`${profileRef.id} profile digest drift`);
    const source = profileBytes.toString("utf8");
    if (profileRef.id === "commerce") return validateCommerceProfile(source);
    if (profileRef.id === "base") return validateBaseProfile(source);
    if (profileRef.id === "graph") return validateGraphProfile(source);
    fail(`unsupported candidate profile ${profileRef.id}`);
  }));
  return validateRegistryContext(catalog, profiles);
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function isRpcId(value) {
  return typeof value === "string" || (typeof value === "number" && Number.isSafeInteger(value));
}

export function handleMcpMessage(message, context, state = { initialized: false }) {
  if (!message || typeof message !== "object" || Array.isArray(message)
    || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(null, -32600, "Invalid JSON-RPC request");
  }
  const hasId = Object.hasOwn(message, "id");
  if (!hasId) {
    if (message.method === "notifications/initialized") state.initialized = true;
    return null;
  }
  if (!isRpcId(message.id)) return rpcError(null, -32600, "Invalid JSON-RPC request ID");
  const id = message.id;
  const params = message.params ?? {};
  if (!params || typeof params !== "object" || Array.isArray(params)) return rpcError(id, -32602, "Request params must be an object");
  if (message.method === "initialize") {
    state.initialized = false;
    return {
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "agentic-design-system-registry", version: "0.5.0" },
        instructions: "Read-only local design ownership registry. Search and get return checked-in data only.",
      },
    };
  }
  if (message.method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (!state.initialized) return rpcError(id, -32002, "Server not initialized");
  if (message.method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: REGISTRY_TOOL_DEFINITIONS } };
  }
  if (message.method === "tools/call") {
    try {
      const result = invokeRegistryTool(params.name, params.arguments ?? {}, context);
      return {
        jsonrpc: "2.0", id,
        result: { content: [{ type: "text", text: JSON.stringify(result) }], isError: false },
      };
    } catch (error) {
      return {
        jsonrpc: "2.0", id,
        result: { content: [{ type: "text", text: error instanceof Error ? error.message : "Registry request failed" }], isError: true },
      };
    }
  }
  return rpcError(id, -32601, `Method not found: ${message.method}`);
}

function assertMachineInvocation(catalog, profiles) {
  const context = { catalog, profiles };
  const sectionsOnly = searchRegistry(catalog, profiles, "/").results;
  if (sectionsOnly.length !== 7 || sectionsOnly.some(row => row.kind !== "section")) fail("/ must resolve only to local sections");
  const byOwner = searchRegistry(catalog, profiles, "@agentic-graph");
  if (!byOwner.results.some(row => row.kind === "owner" && row.ownerId === "agentic-graph")
    || !byOwner.results.some(row => row.kind === "profile" && row.id === "profile:graph")) fail("@owner search missed Graph's exact granted profile");
  const byScope = searchRegistry(catalog, profiles, "#shop");
  const commerce = byScope.results.find(row => row.kind === "profile" && row.id === "profile:commerce");
  if (!byScope.results.some(row => row.kind === "owner" && row.ownerId === "agentic-commerce-os")
    || commerce?.tokens.length !== profiles.find(profile => profile.id === "commerce")?.tokens.length) fail("#scope search missed Commerce owner or candidate keys");
  const byConsumer = searchRegistry(catalog, profiles, "@agentic-commerce-os");
  if (!byConsumer.results.some(row => row.kind === "profile" && row.id === "profile:commerce")) fail("@owner search missed the Commerce consumer pin");
  const byBase = searchRegistry(catalog, profiles, "#shared-data-view");
  if (!byBase.results.some(row => row.kind === "profile" && row.id === "profile:base")) fail("#scope search missed the Base profile");
  const graphKey = profiles.find(profile => profile.id === "graph")?.tokens[0]?.key;
  const byText = searchRegistry(catalog, profiles, graphKey);
  if (!byText.results.some(row => row.kind === "profile" && row.tokens.some(token => token.key === graphKey))) fail("plain search missed a Graph token");
  const bySection = searchRegistry(catalog, profiles, "/tokens");
  if (bySection.results.length !== 1 || bySection.results[0].id !== "section:/tokens") fail("/section search is ambiguous");
  try { searchRegistry(catalog, profiles, "//remote"); fail("external section syntax was not rejected"); }
  catch (error) { if (!(error instanceof TypeError) || error.message.includes("external section syntax")) throw error; }
  const directRecord = getRegistryRecord(catalog, profiles, "token:graph:app-bg", "token");
  if (directRecord.canonicalKey !== "graph:app-bg") fail("exact Graph token lookup drift");
  for (const definition of REGISTRY_TOOL_DEFINITIONS) {
    if (definition.annotations?.readOnlyHint !== true) fail(`tool ${definition.name} must be read-only`);
  }
  const registrations = [];
  const webMcp = { registerTool: async tool => { registrations.push(tool); } };
  return (async () => {
    const registered = await registerWebMcpTools(webMcp, context);
    if (!registered.supported || JSON.stringify(registered.names) !== JSON.stringify(REGISTRY_TOOL_DEFINITIONS.map(tool => tool.name))) fail("WebMCP tool registration differs from the shared capability list");
    const browserSearch = JSON.parse(await registrations[0].execute({ query: "@agentic-graph" }));
    const state = { initialized: false };
    const initialized = handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: MCP_PROTOCOL_VERSION } }, context, state);
    if (initialized.result.protocolVersion !== MCP_PROTOCOL_VERSION || initialized.result.capabilities.tools === undefined) fail("MCP initialize contract drift");
    handleMcpMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, context, state);
    const listed = handleMcpMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, context, state);
    if (JSON.stringify(listed.result.tools.map(tool => tool.name)) !== JSON.stringify(registered.names)) fail("MCP and WebMCP capability names differ");
    if (JSON.stringify(listed.result.tools.map(tool => tool.inputSchema)) !== JSON.stringify(registrations.map(tool => tool.inputSchema))) fail("MCP and WebMCP schemas differ");
    const called = handleMcpMessage({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: REGISTRY_TOOL_DEFINITIONS[0].name, arguments: { query: "@agentic-graph" } } }, context, state);
    const mcpSearch = JSON.parse(called.result.content[0].text);
    if (JSON.stringify(browserSearch) !== JSON.stringify(mcpSearch)) fail("MCP and WebMCP search handlers differ");
    const invalid = handleMcpMessage({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "unknown", arguments: {} } }, context, state);
    if (invalid.result.isError !== true) fail("MCP unknown tools must fail closed");
    const requests = [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "registry-check", version: "1" } } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: REGISTRY_TOOL_DEFINITIONS[0].name, arguments: { query: "@agentic-graph" } } },
    ];
    const mcpOutput = execFileSync(process.execPath, [fileURLToPath(import.meta.url), "mcp"], {
      cwd: root, input: `${requests.map(JSON.stringify).join("\n")}\n`, encoding: "utf8", timeout: 5000,
    });
    const protocolResponses = mcpOutput.trim().split("\n").map(line => JSON.parse(line));
    if (protocolResponses.length !== 3 || protocolResponses[0].result.protocolVersion !== MCP_PROTOCOL_VERSION
      || protocolResponses[1].result.tools.length !== REGISTRY_TOOL_DEFINITIONS.length
      || JSON.stringify(JSON.parse(protocolResponses[2].result.content[0].text)) !== JSON.stringify(mcpSearch)) fail("stdio MCP framing, initialize, tools/list, or tool result contract drift");
  })();
}

async function runMcpStdio() {
  const context = await loadRegistryContext();
  const state = { initialized: false };
  let pending = Buffer.alloc(0);
  let discardingOversized = false;
  const send = response => { if (response) process.stdout.write(`${JSON.stringify(response)}\n`); };
  const parseLine = line => {
    if (!line.length) return;
    let message;
    try { message = JSON.parse(line.toString("utf8")); }
    catch { send(rpcError(null, -32700, "Parse error")); return; }
    send(handleMcpMessage(message, context, state));
  };
  process.stdin.on("data", chunk => {
    const bytes = Buffer.from(chunk);
    let start = 0;
    while (start < bytes.length) {
      const newline = bytes.indexOf(0x0a, start);
      const end = newline < 0 ? bytes.length : newline;
      const part = bytes.subarray(start, end);
      if (discardingOversized) {
        if (newline >= 0) discardingOversized = false;
      } else if (pending.length + part.length > MAX_MCP_MESSAGE_BYTES) {
        pending = Buffer.alloc(0);
        discardingOversized = newline < 0;
        send(rpcError(null, -32700, "Message exceeds 65536 bytes"));
      } else {
        pending = pending.length ? Buffer.concat([pending, part]) : Buffer.from(part);
      }
      if (newline >= 0) {
        if (!discardingOversized) {
          const line = pending[pending.length - 1] === 0x0d ? pending.subarray(0, -1) : pending;
          parseLine(line);
        }
        pending = Buffer.alloc(0);
        start = newline + 1;
      } else start = bytes.length;
    }
  });
  process.stdin.on("end", () => {
    if (pending.length) process.stderr.write("Ignored final MCP input without a newline delimiter.\n");
  });
}

function assertRegistry(registry) {
  exactKeys(registry, ["schema", "registryId", "revision", "owner", "coverage", "keyContract", "owners", "profiles"], "registry");
  if (registry.schema !== "agentic-design-system/owner-registry/v1" || registry.registryId !== "agentic-design-system"
    || registry.revision !== "0.4.0" || registry.owner !== "github.com/huijoohwee/agentic-design-system"
    || registry.coverage !== "Commerce, Base, and Graph candidate profiles are revision-pinned; Graph reuse is limited to four granted artifacts; consumer adoption and whole-repository parity are not claimed") fail("identity or coverage");
  exactKeys(registry.keyContract, ["schema", "canonicalKeyPattern", "cssVariablePattern", "uniqueBy", "overridePolicy"], "key contract");
  if (registry.keyContract.schema !== "agentic-design-system/design-key/v1"
    || registry.keyContract.canonicalKeyPattern !== "^[a-z0-9][a-z0-9.-]*(?::[a-z0-9][a-z0-9.-]*)*$"
    || registry.keyContract.cssVariablePattern !== "^--[a-z][a-z0-9-]*$"
    || JSON.stringify(registry.keyContract.uniqueBy) !== JSON.stringify(["canonicalKey", "cssVariable"])
    || registry.keyContract.overridePolicy !== "deny") fail("key contract");
  if (!Array.isArray(registry.owners) || registry.owners.length !== ownerIds.length
    || JSON.stringify(registry.owners.map(owner => owner.id)) !== JSON.stringify(ownerIds)) fail("owner inventory");
  uniqueRows(registry.owners.map(row => ({ ...row, location: row.repository })), "repository", "repository owner");
  const sourcePaths = registry.owners.flatMap(owner => owner.sources.map(source => `${owner.repository}:${source.path}`));
  if (new Set(sourcePaths).size !== sourcePaths.length) fail("duplicate source path");
  for (const owner of registry.owners) {
    exactKeys(owner, ["id", "name", "repository", "revision", "scopes", "role", "reuseGate", "sources"], `owner ${owner.id}`);
    if (!/^[a-f0-9]{40}$/u.test(owner.revision) || !Array.isArray(owner.scopes) || owner.scopes.length === 0
      || new Set(owner.scopes).size !== owner.scopes.length || !Array.isArray(owner.sources) || owner.sources.length === 0
      || !["reference-only", "rights-review-required", "mit-verified"].includes(owner.reuseGate)) fail(`owner ${owner.id} binding`);
    for (const source of owner.sources) {
      exactKeys(source, ["path", "kind", "digest"], `source ${owner.id}`);
      if (!/^[a-zA-Z0-9._/-]+$/u.test(source.path) || source.path.includes("..")
        || !["policy", "native", "generated"].includes(source.kind) || !/^sha256:[a-f0-9]{64}$/u.test(source.digest)) fail(`source ${owner.id}:${source.path}`);
    }
  }
  if (!Array.isArray(registry.profiles) || registry.profiles.length !== 3
    || JSON.stringify(registry.profiles.map(profile => profile.id)) !== JSON.stringify(["commerce", "base", "graph"])) fail("profile inventory");
  const commerce = registry.profiles[0];
  const base = registry.profiles[1];
  const graph = registry.profiles[2];
  for (const profile of registry.profiles) {
    const keys = ["id", "name", "owner", "repository", "revision", "source", "digest", "scope", "status", "rights", "permissionEvidence", "licenseEvidence", "consumerPins"];
    exactKeys(profile, profile.projection ? [...keys, "projection"] : keys, `profile ${profile.id}`);
    if (!/^[a-f0-9]{40}$/u.test(profile.revision) || !/^sha256:[a-f0-9]{64}$/u.test(profile.digest)
      || !Array.isArray(profile.scope) || new Set(profile.scope).size !== profile.scope.length || profile.status !== "candidate"
      || !Array.isArray(profile.consumerPins) || !Array.isArray(profile.licenseEvidence)) fail(`profile ${profile.id} binding`);
    assertPublicRights(profile);
    if (profile.projection) {
      exactKeys(profile.projection, ["path", "digest"], `projection ${profile.id}`);
      if (!/^\.\/vendor\/[a-z0-9.-]+\.css$/u.test(profile.projection.path)
        || !/^sha256:[a-f0-9]{64}$/u.test(profile.projection.digest)) fail(`projection ${profile.id} binding`);
    }
  }
  if (commerce.id !== "commerce" || commerce.owner !== registry.owner || commerce.repository !== registry.owner
    || commerce.revision !== "c18253b35e8bcc0bed548cfb717ec31909422dbe" || commerce.source !== "./tokens/commerce-profile.json"
    || commerce.digest !== "sha256:000adeb267d0d0ff9527e1227faefcd5fd2c15faee463fa70173204783ea7c9e"
    || commerce.rights !== "cleared" || commerce.permissionEvidence !== "User instruction on 2026-10-29 to centralize the named product repositories in Agentic Design System."
    || JSON.stringify(commerce.scope) !== JSON.stringify(["commerce", "shop", "vendor", "admin", "sme-business-pack"])) fail("Commerce candidate profile binding");
  if (JSON.stringify(commerce.licenseEvidence) !== JSON.stringify([
    { repository: registry.owner, revision: commerce.revision, path: "LICENSE", digest: "sha256:b2e476300173b31043c1222c840b5cd3a8c234d50ffc5f44f104fcbf66fc5ffe" },
    { repository: "github.com/huijoohwee/agentic-commerce-os", revision: "6ce3bc918717b97a738ac831dfb4fb3319a02fb6", path: "LICENSE", digest: "sha256:939721e4008a40f28594af8bdd7c122e388d9b22534ef1e6799dc771023691a1" },
  ]) || commerce.consumerPins.length !== 1 || JSON.stringify(commerce.consumerPins[0]) !== JSON.stringify({
    repository: "github.com/huijoohwee/agentic-commerce-os", revision: "6ce3bc918717b97a738ac831dfb4fb3319a02fb6",
    path: "public/local-first/commerce-theme.css", digest: "sha256:c512ee76dc6160ff41e8bac9706b8e8d0b9e56f42b6c4b128594605e19c93474",
  }) || commerce.projection) fail("Commerce rights or consumer pin evidence");
  if (base.id !== "base" || base.owner !== "github.com/huijoohwee/agentic-base" || base.repository !== base.owner
    || base.revision !== "a5d0f2d87d8c6871e9639f8224f5eaee056c5b6e" || base.source !== "./tokens/base-profile.json"
    || base.status !== "candidate" || base.rights !== "cleared" || base.scope.join(",") !== "shared-data-view"
    || base.permissionEvidence !== "User instruction on 2026-10-29 to centralize the named product repositories; Base MIT license is pinned to the source revision."
    || base.licenseEvidence.length !== 2 || base.consumerPins.length !== 0
    || base.projection?.path !== "./vendor/base-profile.css") fail("Base scoped profile binding");
  if (graph.id !== "graph" || graph.owner !== "github.com/huijoohwee/agentic-graph" || graph.repository !== graph.owner
    || graph.revision !== "bed770d91a9b3f1b663eee9637a472bf19b36361" || graph.source !== "./tokens/graph-profile.json"
    || graph.rights !== "cleared-scoped" || graph.scope.join(",") !== "graph-ui,application-typography"
    || graph.permissionEvidence !== "User grant 2026-10-29: public reuse of the exact four Graph artifacts listed here, with attribution, in this central MIT repository; no broader Graph source grant."
    || graph.licenseEvidence.length !== 1 || graph.consumerPins.length !== 0
    || graph.projection?.path !== "./vendor/graph-profile.css") fail("Graph exact-source grant binding");
  return registry.profiles;
}

async function assertCatalogSchema() {
  let schema;
  try { schema = JSON.parse(await readFile(resolve(root, "site/catalog.schema.json"), "utf8")); }
  catch { fail("catalog schema is not valid JSON"); }
  const rootFields = ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties", "$defs", "allOf"];
  exactKeys(schema, rootFields, "catalog schema");
  const required = ["$schema", "catalogId", "schemaVersion", "release", "requestedPath", "records", "registry"];
  const registry = schema.properties?.registry?.properties;
  const keyContract = registry?.keyContract?.properties;
  const profileSchema = schema.$defs?.profile;
  const profileRequired = ["id", "name", "owner", "repository", "revision", "source", "digest", "scope", "status", "rights", "permissionEvidence", "licenseEvidence", "consumerPins"];
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema"
    || schema.$id !== "agentic-design-system/catalog.schema.json" || schema.type !== "object"
    || schema.additionalProperties !== false || JSON.stringify(schema.required) !== JSON.stringify(required)
    || Object.keys(schema.properties).sort().join(",") !== [...required].sort().join(",")
    || schema.properties?.$schema?.const !== "./catalog.schema.json"
    || schema.properties?.catalogId?.const !== "agentic-design-system"
    || schema.properties?.requestedPath?.const !== "/agentic-design-system/"
    || registry?.schema?.const !== "agentic-design-system/owner-registry/v1"
    || keyContract?.canonicalKeyPattern?.const !== "^[a-z0-9][a-z0-9.-]*(?::[a-z0-9][a-z0-9.-]*)*$"
    || keyContract?.cssVariablePattern?.const !== "^--[a-z][a-z0-9-]*$"
    || keyContract?.overridePolicy?.const !== "deny"
    || registry?.owners?.minItems !== ownerIds.length || registry.owners.maxItems !== ownerIds.length
    || registry?.profiles?.minItems !== 3 || registry.profiles.maxItems !== 3
    || profileSchema?.additionalProperties !== false
    || JSON.stringify(profileSchema?.required) !== JSON.stringify(profileRequired)
    || profileSchema?.properties?.rights?.enum?.join(",") !== "review-required,cleared,cleared-scoped,restricted"
    || profileSchema?.properties?.licenseEvidence?.minItems !== 1
    || profileSchema?.properties?.consumerPins?.minItems !== 0
    || profileSchema?.properties?.projection?.properties?.path?.pattern !== "^\\./vendor/[a-z0-9.-]+\\.css$") {
    fail("catalog schema does not bind the owner and key contract");
  }
  console.log("PASS design-catalog-contract-check · one static schema defines the owner registry and key contract consumed by the browser.");
}

async function walk(directory, prefix = "") {
  const rows = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) fail(`symlink in site tree: ${relative}`);
    if (entry.isDirectory()) rows.push(...await walk(resolve(directory, entry.name), relative));
    else if (entry.isFile() && [".css", ".html", ".js"].includes(extname(entry.name))) rows.push(relative);
  }
  return rows;
}

async function declarationsInSite(claims) {
  const declarations = [];
  const pattern = /(--[a-z][a-z0-9-]*)\s*:\s*([^;{}]+)\s*;/gu;
  for (const path of await walk(resolve(root, "site"))) {
    const text = await readFile(resolve(root, "site", path), "utf8");
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (!claims.has(match[1])) continue;
      declarations.push({ cssVar: match[1], path: `site/${path}`, line: text.slice(0, match.index).split("\n").length });
    }
  }
  return declarations;
}

export async function checkDesignRegistry() {
  await assertCatalogSchema();
  const catalogBytes = await readFile(catalogPath);
  const catalog = JSON.parse(catalogBytes.toString("utf8"));
  exactKeys(catalog, ["$schema", "catalogId", "schemaVersion", "release", "requestedPath", "records", "registry"], "catalog root");
  if (catalog.$schema !== "./catalog.schema.json" || catalog.release?.status !== "draft" || catalog.records.length !== 0) fail("public release must remain draft and empty");
  const profileRefs = assertRegistry(catalog.registry);
  assertFailClosedChecks();
  const profileBytes = new Map();
  const profiles = [];
  for (const ref of profileRefs) {
    const bytes = await readFile(resolve(root, "site", ref.source.slice(2)));
    if (`sha256:${sha(bytes)}` !== ref.digest) fail(`${ref.id} profile digest drift`);
    profileBytes.set(ref.id, bytes);
    if (ref.id === "commerce") {
      const pinned = execFileSync("git", ["show", `${ref.revision}:site/${ref.source.slice(2)}`], { cwd: root });
      if (!pinned.equals(bytes)) fail("Commerce profile differs from its pinned central source revision");
      profiles.push(validateCommerceProfile(bytes.toString("utf8")));
    } else if (ref.id === "base") profiles.push(validateBaseProfile(bytes.toString("utf8")));
    else if (ref.id === "graph") profiles.push(validateGraphProfile(bytes.toString("utf8")));
    else fail(`unsupported profile ${ref.id}`);
  }
  const centralOwner = "github.com/huijoohwee/agentic-design-system";
  for (const ref of profileRefs) {
    const centralLicense = ref.licenseEvidence.find(item => item.repository === centralOwner);
    if (!centralLicense) fail(`${ref.id} central MIT evidence is missing`);
    let pinnedLicense;
    try { pinnedLicense = execFileSync("git", ["show", `${centralLicense.revision}:LICENSE`], { cwd: root }); }
    catch { fail(`${ref.id} publisher license source revision is unavailable`); }
    if (!pinnedLicense.toString("utf8").startsWith("MIT License\n")
      || `sha256:${sha(pinnedLicense)}` !== centralLicense.digest) fail(`${ref.id} publisher MIT evidence drift`);
  }
  const commerce = profiles.find(profile => profile.id === "commerce");
  const base = profiles.find(profile => profile.id === "base");
  const graph = profiles.find(profile => profile.id === "graph");
  const baseRef = profileRefs.find(ref => ref.id === "base");
  const graphRef = profileRefs.find(ref => ref.id === "graph");
  const commerceRef = profileRefs.find(ref => ref.id === "commerce");
  const baseProjection = Buffer.from(renderBaseCss(base, base.source.revision, sha(profileBytes.get("base"))));
  const graphProjection = Buffer.from(renderGraphCss(graph, sha(profileBytes.get("graph"))));
  for (const [ref, projection] of [[baseRef, baseProjection], [graphRef, graphProjection]]) {
    const output = await readFile(resolve(root, "site", ref.projection.path.slice(2)));
    if (!output.equals(projection) || `sha256:${sha(output)}` !== ref.projection.digest) fail(`${ref.id} generated projection drift`);
  }
  const commerceProjection = Buffer.from(renderCommerceCss(commerce, commerceRef.revision, sha(profileBytes.get("commerce"))));
  if (`sha256:${sha(commerceProjection)}` !== commerceRef.consumerPins[0].digest) fail("Commerce generated consumer projection pin drift");
  const notices = await readFile(resolve(root, "site/THIRD-PARTY-NOTICES.txt"), "utf8");
  const graphOwner = catalog.registry.owners.find(owner => owner.id === "agentic-graph");
  if (graphOwner.reuseGate !== "rights-review-required"
    || JSON.stringify(graphOwner.sources.map(({ path, kind, digest }) => ({ path, kind, digest })))
      !== JSON.stringify(graph.sources.map(source => ({ path: source.path, kind: source.path.endsWith(".css") ? "generated" : "native", digest: source.sha256 })))
    || !notices.includes("Graph token and typography values\n-------------------------------\n")
    || !notices.includes(graph.permissionEvidence)
    || !notices.includes("grph-shared/src/ui/kgTokens.ts")
    || !notices.includes("grph-shared/src/ui/typography.ts")
    || !notices.includes("grph-shared/src/ui/fontStacks.js")
    || !notices.includes("canvas/src/styles/kgTokens.generated.css")) fail("Graph permission boundary or attribution drift");
  const baseOwner = catalog.registry.owners.find(owner => owner.id === "agentic-base");
  if (baseOwner.reuseGate !== "mit-verified" || baseOwner.sources.some(source => source.kind === "copied")) fail("Base owner boundary drift");
  const baseLicense = base.license.digest;
  if (baseRef.licenseEvidence.find(item => item.repository === baseRef.repository)?.digest !== baseLicense) fail("Base MIT evidence does not match its source pin");
  const baseStart = "Source: agentic-base@a5d0f2d87d8c6871e9639f8224f5eaee056c5b6e\n";
  const commerceStart = "Commerce theme values\n---------------------\n";
  const baseIndex = notices.indexOf(baseStart);
  const commerceIndex = notices.indexOf(commerceStart);
  const commerceSource = "Source: agentic-commerce-os@6ce3bc918717b97a738ac831dfb4fb3319a02fb6\n";
  const commerceIndexInSection = notices.indexOf(commerceSource);
  if (baseIndex < 0 || commerceIndex <= baseIndex || commerceIndexInSection < commerceIndex) fail("Base or Commerce attribution is missing");
  const baseLicenseText = notices.slice(baseIndex + baseStart.length, commerceIndex).trimEnd() + "\n";
  const commerceLicenseText = notices.slice(commerceIndexInSection + commerceSource.length);
  if (`sha256:${sha(Buffer.from(baseLicenseText))}` !== baseLicense
    || `sha256:${sha(Buffer.from(commerceLicenseText))}` !== commerceRef.licenseEvidence[1].digest) fail("owner MIT notice does not match its pinned license digest");
  await assertMachineInvocation(catalog, profiles);
  const claims = profiles.flatMap(profile => {
    const ref = profileRefs.find(item => item.id === profile.id);
    const ownerPath = `site/tokens/${profile.id}-profile.json`;
    return profile.tokens.map(token => {
      if (!keyPattern.test(token.key) || !variablePattern.test(token.cssVar)) fail(`invalid token key ${profile.id}:${token.key}`);
      return { canonicalKey: `${profile.id}:${token.key}`, cssVar: token.cssVar, ownerPath,
        projectionPath: ref.projection ? `site/${ref.projection.path.slice(2)}` : null, location: `${profile.id}:${token.key}` };
    });
  });
  uniqueRows(claims, "canonicalKey", "canonical key");
  uniqueRows(claims, "cssVar", "CSS variable");
  const declarations = await declarationsInSite(new Set(claims.map(claim => claim.cssVar)));
  assertNoOverrides(claims, declarations);
  console.log(`PASS design-owner-registry-check · ${catalog.registry.owners.length} source owners and ${profiles.length} digest-pinned candidate profiles.`);
  console.log(`PASS design-singleton-enforcement-check · ${claims.length} globally unique keys and variables across three profiles; duplicate and override fixtures rejected; ${declarations.length} owner/projection declarations.`);
  console.log("PASS design-agent-tool-contract-check · browser WebMCP and newline-delimited stdio MCP share read-only schemas and handlers.");
  console.log("PASS design-generated-output-check · Base and Graph projections match their profile pins; Commerce CSS matches its consumer pin.");
  console.log("PASS design-license-boundary-check · Commerce/Base MIT evidence and the exact four-file Graph grant are pinned; Graph source remains private outside that scope.");
  console.log("Scope: three candidate profiles are central and globally unique; no consumer migration, full repository scan, or parity is claimed.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || !["check", "mcp"].includes(process.argv[2])) fail("usage: node scripts/design-registry.mjs check|mcp");
  const operation = process.argv[2] === "check" ? checkDesignRegistry() : runMcpStdio();
  operation.catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
