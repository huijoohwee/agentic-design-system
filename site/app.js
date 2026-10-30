import { registerWebMcpTools, searchRegistry, validateRegistryContext } from "./registry-query.js?v=c104158";

const grid = document.querySelector("#catalog-grid");
const empty = document.querySelector("#catalog-empty");
const search = document.querySelector("#catalog-search");
const searchStatus = document.querySelector("#search-status");
const toolStatus = document.querySelector("#agent-tool-status");
const offlineStatus = document.querySelector("#offline-status");
const catalogNavigation = document.querySelector("#catalog-navigation");
const catalogUrl = new URL("./catalog.json", location.href);
let registryContext = null;

const sectionIndex = document.querySelector(".section-index");
const lateContent = [toolStatus, offlineStatus, document.querySelector("#release-summary"), document.querySelector("footer")];
const revealLateContent = () => lateContent.forEach(element => { element.hidden = false; });

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) throw new TypeError(`${label} fields are invalid`);
}

function assertCatalog(catalog) {
  exactKeys(catalog, ["$schema", "catalogId", "schemaVersion", "release", "requestedPath", "records", "registry"], "Catalog");
  exactKeys(catalog.release, ["version", "status", "sourceRevision", "manifestDigest", "predecessor"], "Release");
  if (catalog.$schema !== "./catalog.schema.json" || catalog.catalogId !== "agentic-design-system"
    || catalog.release.status !== "draft" || catalog.requestedPath !== "/agentic-design-system/"
    || !Array.isArray(catalog.records) || catalog.records.length !== 0
    || !Array.isArray(catalog.registry?.profiles) || catalog.registry.profiles.length !== 3) {
    throw new TypeError("The local catalog is incomplete or is not a draft");
  }
}

function addMetadata(container, fields) {
  const metadata = document.createElement("dl");
  metadata.className = "catalog-meta";
  for (const [label, value] of fields) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = String(value ?? "");
    metadata.append(term, description);
  }
  container.append(metadata);
}

function renderOwner(owner) {
  const article = document.createElement("div");
  const heading = document.createElement("h3");
  const detail = document.createElement("p");
  const sources = document.createElement("ul");
  article.className = "catalog-card";
  article.setAttribute("role", "listitem");
  sources.className = "catalog-evidence";
  heading.textContent = owner.name;
  detail.textContent = `${owner.role} Repository-wide reuse gate: ${owner.reuseGate}.`;
  addMetadata(article, [["Repository", owner.repository], ["Scope", owner.scopes.join(", ")], ["Pinned revision", owner.revision]]);
  for (const source of owner.sources) {
    const item = document.createElement("li");
    item.textContent = `${source.kind}: ${source.path} · ${source.digest}`;
    sources.append(item);
  }
  article.append(heading, detail, sources);
  return article;
}

function tokenValue(token) {
  if (token.values) return `light ${token.values.light} · dark ${token.values.dark} · black ${token.values.black}`;
  if (token.type === "alias") return `alias of ${token.targetKey}`;
  if (token.type === "outline") return `${token.width} ${token.style} · ${token.colorKey}`;
  return token.value;
}

function renderProfile(profile) {
  const article = document.createElement("div");
  const heading = document.createElement("h3");
  const detail = document.createElement("p");
  const disclosure = document.createElement("details");
  const summary = document.createElement("summary");
  const list = document.createElement("ul");
  article.className = "catalog-card";
  article.setAttribute("role", "listitem");
  list.className = "catalog-evidence";
  heading.textContent = profile.name;
  detail.textContent = `${profile.status} profile · ${profile.rights} reuse · no cross-repository adoption claimed.`;
  const pins = profile.consumerPins.length
    ? profile.consumerPins.map(pin => `${pin.repository}@${pin.revision}:${pin.path} · ${pin.digest}`).join("; ")
    : "No consumer adoption pin; candidate values only.";
  addMetadata(article, [
    ["Owner", profile.owner], ["Scope", profile.scope.join(", ")],
    ["Source", `${profile.repository}@${profile.revision}:${profile.source}`], ["Profile digest", profile.digest],
    ["Rights", profile.rights], ["Permission", profile.permissionEvidence],
    ["License evidence", profile.licenseEvidence.map(item => `${item.repository}@${item.revision}:${item.path} · ${item.digest}`).join("; ")],
    ["Consumer pins", pins],
    ...(profile.projection ? [["Generated projection", `${profile.projection.path} · ${profile.projection.digest}`]] : []),
  ]);
  summary.textContent = `${profile.tokens.length} candidate keys · inspect values`;
  disclosure.open = profile.tokens.length <= 10;
  for (const token of profile.tokens) {
    const item = document.createElement("li");
    item.textContent = `${token.canonicalKey} · ${token.cssVar} · ${token.type} · ${tokenValue(token)}`;
    list.append(item);
  }
  disclosure.append(summary, list);
  article.append(heading, detail, disclosure);
  return article;
}

function renderRecord(record) {
  const article = document.createElement("div");
  const heading = document.createElement("h3");
  const detail = document.createElement("p");
  article.className = "catalog-card";
  article.setAttribute("role", "listitem");
  heading.textContent = `${record.name} · @${record.id.replace(/^catalog:/u, "")}`;
  detail.textContent = record.summary;
  addMetadata(article, [["Canonical key", record.canonicalKey], ["Owner", record.owner]]);
  article.append(heading, detail);
  return article;
}

function renderSection(section) {
  const article = document.createElement("div");
  const heading = document.createElement("h3");
  const link = document.createElement("a");
  article.className = "catalog-card";
  article.setAttribute("role", "listitem");
  heading.textContent = `${section.label} section`;
  link.className = "catalog-section-link";
  link.href = section.href;
  link.textContent = `Open ${section.label}`;
  article.append(heading, link);
  return article;
}

function renderCatalog(query = "") {
  if (!registryContext) return;
  let result;
  try {
    result = searchRegistry(registryContext.catalog, [...registryContext.profiles.values()], query);
  } catch (error) {
    grid.replaceChildren();
    empty.hidden = false;
    empty.textContent = error instanceof Error ? error.message : "Search query is invalid.";
    searchStatus.textContent = "Search stopped because its query is outside the local registry contract.";
    return;
  }
  grid.replaceChildren();
  for (const row of result.results) {
    if (row.kind === "owner") grid.append(renderOwner(row));
    else if (row.kind === "profile") grid.append(renderProfile(row));
    else if (row.kind === "record") grid.append(renderRecord(row));
    else if (row.kind === "section") grid.append(renderSection(row));
  }
  const count = result.results.length;
  empty.hidden = count > 0;
  empty.textContent = query.trim() ? "No owner, section, scope, profile, token key, or cleared record matches that search." : "No public catalog records are cleared yet.";
  const ownerCount = result.results.filter(row => row.kind === "owner").length;
  const profileRows = result.results.filter(row => row.kind === "profile");
  const tokenCount = profileRows.reduce((total, profile) => total + profile.tokens.length, 0);
  const recordCount = result.results.filter(row => row.kind === "record").length;
  searchStatus.textContent = `${ownerCount} repository owners · ${profileRows.length} profiles · ${tokenCount} matching candidate keys · ${recordCount} public records.`;
}

function renderNavigation(catalog, profiles) {
  const routes = searchRegistry(catalog, profiles, "/").results.filter(row => row.kind === "section");
  catalogNavigation.replaceChildren();
  for (const route of routes) {
    const link = document.createElement("a");
    link.href = route.href;
    link.textContent = route.label;
    catalogNavigation.append(link);
  }
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function loadRegistry() {
  const response = await fetch(catalogUrl, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
  const catalog = await response.json();
  assertCatalog(catalog);
  if (!crypto.subtle) throw new Error("Pinned profile digests cannot be checked in this browser");
  const profiles = await Promise.all(catalog.registry.profiles.map(async manifest => {
    const profileResponse = await fetch(new URL(manifest.source, catalogUrl), { cache: "no-cache" });
    if (!profileResponse.ok) throw new Error(`Profile request failed: ${profileResponse.status}`);
    const bytes = await profileResponse.arrayBuffer();
    if (await sha256(bytes) !== manifest.digest) throw new Error(`${manifest.id} profile digest does not match its pin`);
    return JSON.parse(new TextDecoder().decode(bytes));
  }));
  registryContext = validateRegistryContext(catalog, profiles);
  renderNavigation(catalog, profiles);
  const profileCount = catalog.registry.profiles.length;
  const tokenCount = profiles.reduce((total, profile) => total + profile.tokens.length, 0);
  document.querySelector("#release-summary").textContent = `${catalog.registry.owners.length} source owners · ${profileCount} pinned candidate profiles · ${tokenCount} globally unique keys/variables · draft catalog; no consumer migrations claimed.`;
  renderCatalog(search.value);
  sectionIndex.hidden = false;
  sectionIndex.removeAttribute("aria-busy");
  revealLateContent();
  try {
    const tools = await registerWebMcpTools(document.modelContext, registryContext);
    toolStatus.textContent = tools.supported
      ? "Read-only browser tools are available to compatible agents."
      : "Compatible browser tools are unavailable here; local search remains available.";
  } catch {
    toolStatus.textContent = "Browser tool registration failed; local search remains available.";
  }
}

search.addEventListener("input", () => renderCatalog(search.value));
loadRegistry().catch(error => {
  sectionIndex.hidden = false;
  sectionIndex.removeAttribute("aria-busy");
  revealLateContent();
  document.querySelector("#release-summary").textContent = "Ownership map unavailable or a pinned profile failed validation.";
  empty.hidden = false;
  empty.textContent = error instanceof Error ? error.message : "The local registry failed validation.";
  searchStatus.textContent = "The local registry did not satisfy its ownership, digest, or singleton contract.";
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js", { scope: "./" })
    .then(() => navigator.serviceWorker.ready)
    .then(() => { offlineStatus.textContent = "Offline cache is ready for this site."; })
    .catch(() => { offlineStatus.textContent = "Offline caching is unavailable in this browser."; });
}
